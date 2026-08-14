import { Db, MongoClient } from 'mongodb'
import { env } from '../config/env'

let client: MongoClient | null = null
let db: Db | null = null

// The MongoDB Node driver's socketTimeoutMS defaults to 0 (disabled) — an
// operation already in flight on an established connection waits forever
// for a response, with no cap at all. This is the exact same "zombie
// connection" class of bug fixed for the chain RPC client (see
// chain/withTimeout.ts's comment) but was never applied here — a degraded
// Atlas connection could hang any Mongo call in the entire API (every
// route, not just the chain-touching ones) with nothing to catch it.
// serverSelectionTimeoutMS/connectTimeoutMS also get explicit (shorter than
// the driver's 30s default) values for the same "fail fast, don't hang"
// reason.
const MONGO_SOCKET_TIMEOUT_MS = 20_000
const MONGO_SERVER_SELECTION_TIMEOUT_MS = 10_000
const MONGO_CONNECT_TIMEOUT_MS = 10_000

export async function connectMongo(): Promise<Db> {
  if (db) return db

  client = new MongoClient(env.MONGODB_URI, {
    socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
  })
  await client.connect()
  db = client.db()
  return db
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB not connected — call connectMongo() first')
  }
  return db
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}
