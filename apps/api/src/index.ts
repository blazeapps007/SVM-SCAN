import { env } from './config/env'
import { connectMongo, disconnectMongo } from './db/connection'
import { connectIndexer, runIndexer } from './indexer/run'
import { buildServer } from './server'

async function main(): Promise<void> {
  const db = await connectMongo()
  console.log('Connected to MongoDB')

  const { tmClient, rpcAddress } = await connectIndexer(db)
  console.log(`Connected to chain RPC at ${rpcAddress}`)

  const app = await buildServer({ db, tmClient })
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`API listening on port ${env.PORT}`)

  // Backfill/live-tail/refreshers run in the background — the server is
  // already accepting requests at this point and will serve whatever's
  // been indexed so far, filling in progressively as this catches up.
  //
  // The periodic refreshers (validators/params/proposals) already catch
  // their own errors and just retry on the next tick — this only fires for
  // an unrecoverable failure in the core backfill/checkpoint pipeline (e.g.
  // a chain query that timed out because the node is down). Rather than
  // trying to reconnect and resume in-process — which would also need to
  // re-establish the live-tail subscription cleanly — exit and let the
  // process supervisor (Docker's `restart: unless-stopped`) restart with a
  // fresh connection; indexing resumes exactly where it left off via the
  // Mongo checkpoint, and a fresh restart also means a configured backup
  // RPC node gets a chance if the primary is still down (see
  // connectIndexer / RPC_ADDRESS_BACKUP_1/2).
  runIndexer(db, tmClient).catch((err) => {
    console.error('Indexer run failed, exiting for a clean restart:', err)
    process.exit(1)
  })

  const shutdown = async () => {
    console.log('Shutting down...')
    await app.close()
    tmClient.disconnect()
    await disconnectMongo()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
