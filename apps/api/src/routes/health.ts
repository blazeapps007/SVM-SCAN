import type { FastifyInstance } from 'fastify'
import type { HealthResponse } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  INDEXER_STATE_COLLECTION,
  INDEXER_STATE_ID,
  IndexerStateDoc,
} from '../db/schemas/indexerState.schema'

export function registerHealthRoutes(
  app: FastifyInstance,
  { db, tmClient }: AppContext
): void {
  app.get('/health', async (): Promise<HealthResponse> => {
    let mongoOk = false
    try {
      await db.command({ ping: 1 })
      mongoOk = true
    } catch {
      mongoOk = false
    }

    let chainOk = false
    try {
      await tmClient.status()
      chainOk = true
    } catch {
      chainOk = false
    }

    const state = await db
      .collection<IndexerStateDoc>(INDEXER_STATE_COLLECTION)
      .findOne({ _id: INDEXER_STATE_ID })

    return {
      status: mongoOk && chainOk ? 'ok' : 'degraded',
      mongo: mongoOk,
      chain: chainOk,
      indexerMode: state?.mode ?? 'backfill',
      lastIndexedHeight: state?.lastIndexedHeight ?? 0,
    }
  })
}
