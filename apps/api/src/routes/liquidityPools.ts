import type { FastifyInstance } from 'fastify'
import type { LiquidityPoolSummary } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  LIQUIDITY_POOLS_COLLECTION,
  LiquidityPoolDoc,
} from '../db/schemas/liquidityPool.schema'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

function toSummary(doc: LiquidityPoolDoc): LiquidityPoolSummary {
  return {
    poolAddress: doc.poolAddress,
    factoryAddress: doc.factoryAddress,
    token0: { address: doc.token0Address, ...doc.token0 },
    token1: { address: doc.token1Address, ...doc.token1 },
    fee: doc.fee,
    tickSpacing: doc.tickSpacing,
    createdAtHeight: doc.createdAtHeight,
    createdAtTxHash: doc.createdAtTxHash,
    createdAt: doc.createdAt.toISOString(),
  }
}

export function registerLiquidityPoolRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  const collection = db.collection<LiquidityPoolDoc>(LIQUIDITY_POOLS_COLLECTION)

  app.get<{ Querystring: PageQuery }>('/liquidity-pools', async (request) => {
    const { page, perPage, skip } = parsePagination(request.query, 25)

    const [docs, total] = await Promise.all([
      collection
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .toArray(),
      collection.countDocuments(),
    ])

    return paginatedResponse(docs.map(toSummary), page, perPage, total)
  })
}
