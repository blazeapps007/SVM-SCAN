import type { FastifyInstance } from 'fastify'
import type {
  AccountDetailResponse,
  RecentAccount,
  TransactionSummary,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import { VALIDATORS_COLLECTION, ValidatorDoc } from '../db/schemas/validator.schema'
import { getAccount, getAllBalances, getBalanceStaked } from '../chain/query'
import { accountToValoperAddress } from '../chain/helpers'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

const ACCOUNT_CACHE_TTL_MS = 15_000
const accountCache = new Map<
  string,
  { fetchedAt: number; data: AccountDetailResponse }
>()

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

export function registerAccountRoutes(
  app: FastifyInstance,
  { db, tmClient }: AppContext
): void {
  const txCollection = db.collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
  const validatorCollection = db.collection<ValidatorDoc>(VALIDATORS_COLLECTION)

  app.get<{ Querystring: { limit?: string } }>(
    '/accounts/recent',
    async (request) => {
      const limit = Math.min(
        50,
        Math.max(1, parseInt(request.query.limit ?? '10', 10) || 10)
      )

      const results = await txCollection
        .aggregate<{
          _id: string
          lastMessageType: string
          lastActivityTime: Date
        }>([
          { $sort: { timestamp: -1 } },
          { $limit: 200 },
          { $unwind: '$senders' },
          {
            $group: {
              _id: '$senders',
              lastMessageType: {
                $first: { $arrayElemAt: ['$messageTypes', 0] },
              },
              lastActivityTime: { $first: '$timestamp' },
            },
          },
          { $sort: { lastActivityTime: -1 } },
          { $limit: limit },
        ])
        .toArray()

      const recent: RecentAccount[] = results.map((r) => ({
        address: r._id,
        lastMessageType: r.lastMessageType ?? '',
        lastActivityTime: r.lastActivityTime.toISOString(),
      }))
      return recent
    }
  )

  app.get<{ Params: { address: string } }>(
    '/accounts/:address',
    async (request, reply) => {
      const { address } = request.params

      const cached = accountCache.get(address)
      if (cached && Date.now() - cached.fetchedAt < ACCOUNT_CACHE_TTL_MS) {
        return cached.data
      }

      // A validator's operator address is this same account, just
      // re-prefixed (see accountToValoperAddress) — check whether this
      // account happens to also be a validator, so the frontend can link
      // to its validator profile.
      const valoperAddress = accountToValoperAddress(address)
      const validatorLookup = valoperAddress
        ? validatorCollection.findOne(
            { operatorAddress: valoperAddress },
            { projection: { operatorAddress: 1, moniker: 1, identity: 1 } }
          )
        : Promise.resolve(null)

      // Each piece is fetched independently — this chain uses a custom
      // EVM-compatible pubkey type cosmjs doesn't recognize, so getAccount()
      // reliably throws for EVM-derived addresses. That must not take down
      // balances/staked (which fetch fine on their own) along with it.
      const [accountResult, balancesResult, stakedResult, validatorResult] =
        await Promise.allSettled([
          getAccount(tmClient, address),
          getAllBalances(tmClient, address),
          getBalanceStaked(tmClient, address),
          validatorLookup,
        ])

      if (balancesResult.status === 'rejected') {
        request.log.error(balancesResult.reason)
        return reply
          .status(502)
          .send({ error: 'Failed to fetch account balances from chain' })
      }

      if (accountResult.status === 'rejected') {
        request.log.warn(accountResult.reason)
      }
      if (stakedResult.status === 'rejected') {
        request.log.warn(stakedResult.reason)
      }

      const account =
        accountResult.status === 'fulfilled' ? accountResult.value : null
      const staked =
        stakedResult.status === 'fulfilled' ? stakedResult.value : null
      const validatorDoc =
        validatorResult.status === 'fulfilled' ? validatorResult.value : null

      const data: AccountDetailResponse = {
        address,
        accountNumber: account?.accountNumber?.toString() ?? '0',
        sequence: account?.sequence?.toString() ?? '0',
        balances: [...balancesResult.value],
        stakedBalance: staked ?? null,
        validator: validatorDoc
          ? {
              operatorAddress: validatorDoc.operatorAddress,
              moniker: validatorDoc.moniker,
              identity: validatorDoc.identity,
            }
          : null,
      }

      accountCache.set(address, { fetchedAt: Date.now(), data })
      return data
    }
  )

  app.get<{ Params: { address: string }; Querystring: PageQuery }>(
    '/accounts/:address/transactions',
    async (request) => {
      const { page, perPage, skip } = parsePagination(request.query, 10)
      const filter = { senders: request.params.address }

      const [docs, total] = await Promise.all([
        txCollection
          .find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(perPage)
          .toArray(),
        txCollection.countDocuments(filter),
      ])

      return paginatedResponse(
        docs.map(toTransactionSummary),
        page,
        perPage,
        total
      )
    }
  )
}
