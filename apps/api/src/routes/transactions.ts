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

const ORACLE_ATTESTATION_TYPE_URLS = new Set([
  '/steemvm.steembridge.v1.MsgSubmitSteemDeposit',
  '/steemvm.steembridge.v1.MsgSubmitNameRegistration',
])

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
  app.get<{ Querystring: PageQuery }>('/transactions', async (request) => {
    const { page, perPage, skip } = parsePagination(request.query, 50)
    const collection = db.collection<TransactionDoc>(TRANSACTIONS_COLLECTION)

    const [docs, total] = await Promise.all([
      collection
        .find()
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(perPage)
        .toArray(),
      collection.estimatedDocumentCount(),
    ])

    return paginatedResponse(
      docs.map(toTransactionSummary),
      page,
      perPage,
      total
    )
  })

  app.get<{ Params: { hash: string } }>(
    '/transactions/:hash',
    async (request, reply) => {
      const hash = request.params.hash.toUpperCase()
      const doc = await db
        .collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
        .findOne({ hash })
      if (!doc) {
        return reply.status(404).send({ error: 'Transaction not found' })
      }

      const state = await db
        .collection<IndexerStateDoc>(INDEXER_STATE_COLLECTION)
        .findOne({ _id: INDEXER_STATE_ID })

      const messages = await Promise.all(
        doc.messages.map(async (message) => {
          if (
            !ORACLE_ATTESTATION_TYPE_URLS.has(message.typeUrl) ||
            !message.data ||
            typeof message.data !== 'object'
          ) {
            return message
          }
          const data = message.data as { validator?: string }
          const oracleMoniker = data.validator
            ? await resolveValidatorMoniker(db, data.validator)
            : null
          return {
            ...message,
            data: { ...data, oracleMoniker },
          }
        })
      )

      const response: TransactionDetailResponse = {
        ...toTransactionSummary(doc),
        log: doc.log,
        memo: doc.memo,
        chainId: state?.chainId ?? '',
        messages: messages as TransactionDetailResponse['messages'],
        events: doc.events,
        senders: doc.senders,
        ibcTransfer: doc.ibcTransfer,
      }
      return response
    }
  )
}
