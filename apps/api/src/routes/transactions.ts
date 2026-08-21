import type { FastifyInstance } from 'fastify'
import type {
  TransactionDetailResponse,
  TransactionSummary,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import {
  INDEXER_STATE_COLLECTION,
  INDEXER_STATE_ID,
  IndexerStateDoc,
} from '../db/schemas/indexerState.schema'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'
import { resolveValidatorMoniker } from '../db/validatorLookup'
import { fetchNameRegistration } from '../chain/steembridgeLcd'
import { fetchModuleAccountNames } from '../chain/moduleAccounts'
import { env } from '../config/env'
import { TtlCache } from '../utils/ttlCache'

// Every message type whose decoded `data` has a `validator` field holding a
// bech32 *account* address for an oracle/validator identity — each gets the
// same `oracleMoniker` enrichment merged in below, regardless of which
// module (steembridge or oracledata) it belongs to.
const ORACLE_ATTESTATION_TYPE_URLS = new Set([
  '/steemvm.steembridge.v1.MsgAttestDeposit',
  '/steemvm.steembridge.v1.MsgSubmitNameRegistration',
  '/steemvm.steembridge.v1.MsgAttestWithdrawalPayout',
  '/steemvm.oracle.data.v1.MsgAggregateExchangeRateVote',
  '/steemvm.oracle.data.v1.MsgAggregateExchangeRatePrevote',
])

const MSG_CONFIRM_NAME_TYPE_URL = '/steemvm.steembridge.v1.MsgConfirmName'

// What MetaMask/an EVM wallet links to ("view on explorer") — the *inner*
// Ethereum tx hash, not this chain's outer Tendermint tx hash that wraps it
// as a single MsgEthereumTx. Only the latter is indexed as `hash`, so a
// lookup by this form needs the fallback below.
const EVM_TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

// Module account addresses are derived from the module name, not chain
// state — this never changes for a given chain binary, so a long TTL is
// safe and avoids an LCD round trip on every transaction detail view.
const moduleAccountsCache = new TtlCache<Map<string, string>>(60 * 60_000)

async function getModuleAccountNames(): Promise<Record<string, string>> {
  if (!env.STEEMBRIDGE_LCD_URL) return {}

  const cached = moduleAccountsCache.get('all')
  if (cached) return Object.fromEntries(cached)

  try {
    const map = await fetchModuleAccountNames(env.STEEMBRIDGE_LCD_URL)
    moduleAccountsCache.set('all', map)
    return Object.fromEntries(map)
  } catch (err) {
    console.error('Failed to fetch module account names:', err)
    return {}
  }
}

function toTransactionSummary(doc: TransactionDoc): TransactionSummary {
  return {
    hash: doc.hash,
    height: doc.height,
    timestamp: doc.timestamp.toISOString(),
    code: doc.code,
    success: doc.code === 0,
    messageTypes: doc.messageTypes,
    fee: doc.fee,
    gasUsed: doc.gasUsed,
    gasWanted: doc.gasWanted,
  }
}

export function registerTransactionRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  app.get<{ Querystring: PageQuery & { type?: string } }>(
    '/transactions',
    async (request) => {
      const { page, perPage, skip } = parsePagination(request.query, 50)
      const collection = db.collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
      // messageTypes is an array field — an equality filter against it matches
      // any doc whose array *contains* this value, which is exactly "does
      // this tx include a message of this type."
      const filter = request.query.type
        ? { messageTypes: request.query.type }
        : {}

      const [docs, total] = await Promise.all([
        collection
          .find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(perPage)
          .toArray(),
        // estimatedDocumentCount() ignores filters (it's a fast collection-
        // wide metadata read) — only safe to use on the unfiltered path.
        request.query.type
          ? collection.countDocuments(filter)
          : collection.estimatedDocumentCount(),
      ])

      return paginatedResponse(
        docs.map(toTransactionSummary),
        page,
        perPage,
        total
      )
    }
  )

  // Every distinct messageTypes value currently indexed — powers the type
  // filter dropdown on the transactions list. Index-covered (see
  // db/indexes.ts's message_types index), so cheap even at scale.
  app.get('/transactions/message-types', async (): Promise<string[]> => {
    const types = (await db
      .collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
      .distinct('messageTypes')) as string[]
    return types.sort()
  })

  app.get<{ Params: { hash: string } }>(
    '/transactions/:hash',
    async (request, reply) => {
      const rawHash = request.params.hash
      const hash = rawHash.toUpperCase()
      const collection = db.collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
      let doc = await collection.findOne({ hash })

      // Not found by the outer Tendermint hash — if this looks like an EVM
      // tx hash instead, the tx that wraps it is still findable by its
      // decoded inner hash (decodeMsgEthereumTx always lowercases it).
      if (!doc && EVM_TX_HASH_PATTERN.test(rawHash)) {
        doc = await collection.findOne({
          'messages.data.hash': rawHash.toLowerCase(),
        })
      }

      if (!doc) {
        return reply.status(404).send({ error: 'Transaction not found' })
      }

      const state = await db
        .collection<IndexerStateDoc>(INDEXER_STATE_COLLECTION)
        .findOne({ _id: INDEXER_STATE_ID })

      const messages = await Promise.all(
        doc.messages.map(async (message) => {
          if (!message.data || typeof message.data !== 'object') {
            return message
          }

          if (ORACLE_ATTESTATION_TYPE_URLS.has(message.typeUrl)) {
            const data = message.data as { validator?: string }
            const oracleMoniker = data.validator
              ? await resolveValidatorMoniker(db, data.validator)
              : null
            return { ...message, data: { ...data, oracleMoniker } }
          }

          if (
            message.typeUrl === MSG_CONFIRM_NAME_TYPE_URL &&
            env.STEEMBRIDGE_LCD_URL
          ) {
            const data = message.data as { registrationId?: string }
            const registration = data.registrationId
              ? await fetchNameRegistration(
                  env.STEEMBRIDGE_LCD_URL,
                  data.registrationId
                )
              : null
            return {
              ...message,
              data: {
                ...data,
                linkedSteemAccount: registration?.steem_account ?? null,
              },
            }
          }

          return message
        })
      )

      const moduleAccounts = await getModuleAccountNames()

      const response: TransactionDetailResponse = {
        ...toTransactionSummary(doc),
        log: doc.log,
        memo: doc.memo,
        chainId: state?.chainId ?? '',
        messages: messages as TransactionDetailResponse['messages'],
        events: doc.events,
        senders: doc.senders,
        ibcTransfer: doc.ibcTransfer,
        moduleAccounts,
      }
      return response
    }
  )
}
