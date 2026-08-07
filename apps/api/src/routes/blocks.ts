import type { FastifyInstance } from 'fastify'
import type {
  BlockDetailResponse,
  BlockSummary,
  TransactionSummary,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
import { BLOCKS_COLLECTION, BlockDoc } from '../db/schemas/block.schema'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

function toBlockSummary(doc: BlockDoc): BlockSummary {
  return {
    height: doc.height,
    hash: doc.hash,
    time: doc.time.toISOString(),
    proposerAddress: doc.proposerAddress,
    appHash: doc.appHash,
    txCount: doc.txCount,
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

export function registerBlockRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  app.get<{ Querystring: PageQuery }>('/blocks', async (request) => {
    const { page, perPage, skip } = parsePagination(request.query, 50)
    const collection = db.collection<BlockDoc>(BLOCKS_COLLECTION)

    const [docs, total] = await Promise.all([
      collection
        .find()
        .sort({ height: -1 })
        .skip(skip)
        .limit(perPage)
        .toArray(),
      collection.estimatedDocumentCount(),
    ])

    return paginatedResponse(docs.map(toBlockSummary), page, perPage, total)
  })

  app.get<{ Params: { height: string } }>(
    '/blocks/:height',
    async (request, reply) => {
      const height = parseInt(request.params.height, 10)
      if (Number.isNaN(height)) {
        return reply.status(400).send({ error: 'Invalid block height' })
      }

      const doc = await db
        .collection<BlockDoc>(BLOCKS_COLLECTION)
        .findOne({ height })
      if (!doc) {
        return reply.status(404).send({ error: 'Block not found' })
      }

      const response: BlockDetailResponse = {
        ...toBlockSummary(doc),
        txHashes: doc.txHashes,
      }
      return response
    }
  )

  app.get<{ Params: { height: string } }>(
    '/blocks/:height/transactions',
    async (request, reply) => {
      const height = parseInt(request.params.height, 10)
      if (Number.isNaN(height)) {
        return reply.status(400).send({ error: 'Invalid block height' })
      }

      const docs = await db
        .collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
        .find({ height })
        .toArray()

      return docs.map(toTransactionSummary)
    }
  )
}
