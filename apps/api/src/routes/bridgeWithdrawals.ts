import type { FastifyInstance } from 'fastify'
import type { BridgeWithdrawal, BridgeWithdrawalStats } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  BRIDGE_WITHDRAWALS_COLLECTION,
  BridgeWithdrawalDoc,
} from '../db/schemas/bridgeWithdrawal.schema'
import { fetchBridgeStatistics } from '../chain/steembridgeLcd'
import { env } from '../config/env'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

const STATUS_FILTER_MAP: Record<string, string> = {
  requested: 'WITHDRAWAL_STATUS_REQUESTED',
}

function toWithdrawal(doc: BridgeWithdrawalDoc): BridgeWithdrawal {
  return {
    id: doc.id,
    sender: doc.sender,
    destinationSteemAccount: doc.destinationSteemAccount,
    amountAsteem: doc.amountAsteem,
    amountMillisteem: doc.amountMillisteem,
    memo: doc.memo,
    burnTxHash: doc.burnTxHash,
    status: doc.status as BridgeWithdrawal['status'],
    createdAtHeight: doc.createdAtHeight,
  }
}

export function registerBridgeWithdrawalRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  const collection = db.collection<BridgeWithdrawalDoc>(
    BRIDGE_WITHDRAWALS_COLLECTION
  )

  app.get(
    '/bridge-withdrawals/stats',
    async (): Promise<BridgeWithdrawalStats> => {
      const [total, requested, stats] = await Promise.all([
        collection.countDocuments({}),
        collection.countDocuments({ status: 'WITHDRAWAL_STATUS_REQUESTED' }),
        env.STEEMBRIDGE_LCD_URL
          ? fetchBridgeStatistics(env.STEEMBRIDGE_LCD_URL)
          : null,
      ])

      return {
        total,
        requested,
        totalMintedAsteem: stats?.total_minted_asteem ?? '0',
        totalBurnedAsteem: stats?.total_burned_asteem ?? '0',
        netOutstandingAsteem: stats?.net_outstanding ?? '0',
      }
    }
  )

  app.get<{ Querystring: PageQuery & { status?: string } }>(
    '/bridge-withdrawals',
    async (request) => {
      const { page, perPage, skip } = parsePagination(request.query, 25)
      const status = request.query.status
        ? STATUS_FILTER_MAP[request.query.status]
        : undefined
      const filter = status ? { status } : {}

      const [docs, total] = await Promise.all([
        collection
          .find(filter)
          .sort({ idNum: -1 })
          .skip(skip)
          .limit(perPage)
          .toArray(),
        collection.countDocuments(filter),
      ])

      return paginatedResponse(docs.map(toWithdrawal), page, perPage, total)
    }
  )

  app.get<{ Params: { idOrBurnTxHash: string } }>(
    '/bridge-withdrawals/:idOrBurnTxHash',
    async (request, reply) => {
      const { idOrBurnTxHash } = request.params
      const doc = await collection.findOne({
        $or: [{ id: idOrBurnTxHash }, { burnTxHash: idOrBurnTxHash }],
      })
      if (!doc) {
        return reply.status(404).send({ error: 'Bridge withdrawal not found' })
      }
      return toWithdrawal(doc)
    }
  )
}
