import { Db } from 'mongodb'
import {
  INDEXER_STATE_COLLECTION,
  INDEXER_STATE_ID,
  IndexerStateDoc,
} from '../db/schemas/indexerState.schema'

export async function getOrCreateIndexerState(
  db: Db,
  chainId: string
): Promise<IndexerStateDoc> {
  const collection = db.collection<IndexerStateDoc>(INDEXER_STATE_COLLECTION)
  const existing = await collection.findOne({ _id: INDEXER_STATE_ID })
  if (existing) return existing

  const initial: IndexerStateDoc = {
    _id: INDEXER_STATE_ID,
    chainId,
    lastIndexedHeight: 0,
    lastIndexedHash: '',
    mode: 'backfill',
    updatedAt: new Date(),
  }
  await collection.insertOne(initial)
  return initial
}

export async function updateCheckpoint(
  db: Db,
  update: Partial<Omit<IndexerStateDoc, '_id'>>
): Promise<void> {
  const collection = db.collection<IndexerStateDoc>(INDEXER_STATE_COLLECTION)
  await collection.updateOne(
    { _id: INDEXER_STATE_ID },
    { $set: { ...update, updatedAt: new Date() } }
  )
}
