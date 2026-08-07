import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Db } from 'mongodb'
import {
  getDenomMetadata,
  listDenomMetadata,
} from '../../src/indexer/denomRegistry'
import {
  DENOM_METADATA_COLLECTION,
  DenomMetadataDoc,
} from '../../src/db/schemas/denomMetadata.schema'

let mongod: MongoMemoryServer
let client: MongoClient
let db: Db

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  client = new MongoClient(mongod.getUri())
  await client.connect()
  db = client.db('dexplorer-test')

  const doc: DenomMetadataDoc = {
    _id: 'uatom',
    displayName: 'Cosmos Hub',
    symbol: 'ATOM',
    decimals: 6,
    source: 'seed',
    updatedAt: new Date(),
  }
  await db
    .collection<DenomMetadataDoc>(DENOM_METADATA_COLLECTION)
    .insertOne(doc)
})

afterAll(async () => {
  await client.close()
  await mongod.stop()
})

describe('denomRegistry', () => {
  it('returns the curated entry when one exists', async () => {
    const result = await getDenomMetadata(db, 'uatom')
    expect(result).toEqual({
      denom: 'uatom',
      displayName: 'Cosmos Hub',
      symbol: 'ATOM',
      decimals: 6,
      source: 'seed',
    })
  })

  it('falls back to the prefix heuristic for an unknown u-denom', async () => {
    const result = await getDenomMetadata(db, 'uunknown')
    expect(result.source).toBe('fallback')
    expect(result.decimals).toBe(6)
  })

  it('falls back to 18 decimals for an unknown a-denom', async () => {
    const result = await getDenomMetadata(db, 'aunknown')
    expect(result.source).toBe('fallback')
    expect(result.decimals).toBe(18)
  })

  it('lists only curated entries', async () => {
    const all = await listDenomMetadata(db)
    expect(all).toHaveLength(1)
    expect(all[0].denom).toBe('uatom')
  })
})
