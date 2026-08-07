import { env } from './config/env'
import { connectMongo, disconnectMongo } from './db/connection'
import { connectIndexer, runIndexer } from './indexer/run'
import { buildServer } from './server'

async function main(): Promise<void> {
  const db = await connectMongo()
  console.log('Connected to MongoDB')

  const { tmClient } = await connectIndexer(db)
  console.log(`Connected to chain RPC at ${env.RPC_ADDRESS}`)

  const app = await buildServer({ db, tmClient })
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`API listening on port ${env.PORT}`)

  // Backfill/live-tail/refreshers run in the background — the server is
  // already accepting requests at this point and will serve whatever's
  // been indexed so far, filling in progressively as this catches up.
  runIndexer(db, tmClient).catch((err) => {
    console.error('Indexer run failed:', err)
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
