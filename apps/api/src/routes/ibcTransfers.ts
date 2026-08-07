import type { FastifyInstance } from 'fastify'
import type { IBCTransferSummary } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

export function registerIBCTransferRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  const collection = db.collection<TransactionDoc>(TRANSACTIONS_COLLECTION)

  app.get<{ Querystring: PageQuery }>('/ibc-transfers', async (request) => {
    const { page, perPage, skip } = parsePagination(request.query, 100)
    const filter = { ibcTransfer: { $ne: null } }

    const [docs, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ height: -1 })
        .skip(skip)
        .limit(perPage)
        .toArray(),
      collection.countDocuments(filter),
    ])

    const data: IBCTransferSummary[] = []
    for (const doc of docs) {
      if (!doc.ibcTransfer) continue
      data.push({
        ...doc.ibcTransfer,
        hash: doc.hash,
        height: doc.height,
        timestamp: doc.timestamp.toISOString(),
        status: doc.code === 0 ? 'success' : 'failed',
      })
    }

    return paginatedResponse(data, page, perPage, total)
  })
}
