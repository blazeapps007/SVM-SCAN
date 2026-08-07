import { Db, MongoClient } from 'mongodb'
import { env } from '../config/env'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectMongo(): Promise<Db> {
  if (db) return db

  client = new MongoClient(env.MONGODB_URI)
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
