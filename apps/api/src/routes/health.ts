import type { FastifyInstance } from 'fastify'
import type { HealthResponse } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  INDEXER_STATE_COLLECTION,
  INDEXER_STATE_ID,
  IndexerStateDoc,
} from '../db/schemas/indexerState.schema'
import { withChainTimeout } from '../chain/connectionHealth'
import { withTimeout } from '../chain/withTimeout'

export function registerHealthRoutes(
  app: FastifyInstance,
  { db, tmClient }: AppContext
): void {
  app.get('/health', async (): Promise<HealthResponse> => {
    let mongoOk = false
    try {
      await withTimeout(db.command({ ping: 1 }), 'health:mongo-ping', 5000)
      mongoOk = true
    } catch {
      mongoOk = false
    }

    let chainOk = false
    try {
      // Must go through the same timeout-protected path as every other
      // chain call (see connectionHealth.ts) — this is the one request the
      // entire frontend gates on (useApiHealth), so a raw, unwrapped
      // tmClient.status() call here can hang the whole UI indefinitely if
      // the connection has zombied, instead of reporting chain: false.
      await withChainTimeout(tmClient.status(), 'health:status')
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
