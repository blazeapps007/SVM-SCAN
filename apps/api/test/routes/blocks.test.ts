import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Db } from 'mongodb'
import type { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import type {
  Paginated,
  BlockSummary,
  BlockDetailResponse,
} from '@dexplorer/shared'
import { buildServer } from '../../src/server'
import { BLOCKS_COLLECTION, BlockDoc } from '../../src/db/schemas/block.schema'

let mongod: MongoMemoryServer
let client: MongoClient
let db: Db

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  client = new MongoClient(mongod.getUri())
  await client.connect()
  db = client.db('dexplorer-test')

  const blocks: BlockDoc[] = [
    {
      height: 100,
      hash: 'HASH100',
      time: new Date('2024-01-01T00:00:00Z'),
      proposerAddress: 'PROPOSER',
      appHash: 'APPHASH',
      txCount: 2,
      txHashes: ['TX1', 'TX2'],
    },
    {
      height: 99,
      hash: 'HASH99',
      time: new Date('2023-12-31T23:59:00Z'),
      proposerAddress: 'PROPOSER',
      appHash: 'APPHASH99',
      txCount: 0,
      txHashes: [],
    },
  ]
  await db.collection<BlockDoc>(BLOCKS_COLLECTION).insertMany(blocks)
})

afterAll(async () => {
  await client.close()
  await mongod.stop()
})

describe('block routes', () => {
  it('GET /api/blocks returns paginated recent blocks, newest first', async () => {
    const app = await buildServer({
      db,
      tmClient: {} as unknown as Tendermint37Client,
    })

    const response = await app.inject({ method: 'GET', url: '/api/blocks' })
    expect(response.statusCode).toBe(200)

    const body = response.json() as Paginated<BlockSummary>
    expect(body.data).toHaveLength(2)
    expect(body.data[0].height).toBe(100)
    expect(body.pagination.total).toBe(2)

    await app.close()
  })

  it('GET /api/blocks/:height returns a single block with txHashes', async () => {
    const app = await buildServer({
      db,
      tmClient: {} as unknown as Tendermint37Client,
    })

    const response = await app.inject({ method: 'GET', url: '/api/blocks/100' })
    expect(response.statusCode).toBe(200)

    const body = response.json() as BlockDetailResponse
    expect(body.height).toBe(100)
    expect(body.txHashes).toEqual(['TX1', 'TX2'])

    await app.close()
  })

  it('GET /api/blocks/:height returns 404 for an unknown height', async () => {
    const app = await buildServer({
      db,
      tmClient: {} as unknown as Tendermint37Client,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/blocks/999999',
    })
    expect(response.statusCode).toBe(404)

    await app.close()
  })
})
