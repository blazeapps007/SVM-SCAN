import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Db } from 'mongodb'
import type { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import type { Paginated, ValidatorSummary } from '@dexplorer/shared'
import { getNetInfoPeers, getRpcSelfNode } from '../../src/chain/query'
import { lookupCountry } from '../../src/chain/geoip'
import { refreshNodeLocations } from '../../src/indexer/nodeLocationRefresh'
import { buildServer } from '../../src/server'
import {
  VALIDATORS_COLLECTION,
  ValidatorDoc,
} from '../../src/db/schemas/validator.schema'

vi.mock('../../src/chain/query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/chain/query')>()),
  getNetInfoPeers: vi.fn(),
  getRpcSelfNode: vi.fn(),
}))
vi.mock('../../src/chain/geoip', () => ({ lookupCountry: vi.fn() }))

const COUNTRY_BY_IP: Record<string, { code: string; name: string }> = {
  '62.169.19.142': { code: 'FR', name: 'France' },
  '57.131.13.43': { code: 'IT', name: 'Italy' },
}

const tmClient = {} as unknown as Tendermint37Client
let mongod: MongoMemoryServer
let client: MongoClient
let db: Db

const validator = (
  operatorAddress: string,
  moniker: string,
  status = 'BOND_STATUS_BONDED'
): ValidatorDoc => ({
  operatorAddress,
  moniker,
  identity: '',
  website: '',
  details: '',
  status,
  jailed: status !== 'BOND_STATUS_BONDED',
  tokens: '1000',
  delegatorShares: '1000',
  commissionRate: '0',
  minSelfDelegation: '1',
  unbondingHeight: '0',
  consensusPubkey: null,
  consAddressHex: null,
  uptime: null,
  lastRefreshedAt: new Date(),
})

const locationOf = async (operatorAddress: string) =>
  (await db.collection<ValidatorDoc>(VALIDATORS_COLLECTION).findOne({ operatorAddress }))
    ?.nodeLocation

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  client = new MongoClient(mongod.getUri())
  await client.connect()
  db = client.db('dexplorer-test')
})

afterAll(async () => {
  await client.close()
  await mongod.stop()
})

beforeEach(async () => {
  await db.collection(VALIDATORS_COLLECTION).deleteMany({})
  await db
    .collection<ValidatorDoc>(VALIDATORS_COLLECTION)
    .insertMany([
      validator('valPeer', 'blaze.apps'),
      validator('valSelf', 'blazed007'),
      validator('valAbsent', 'not-peered'),
      // An old jailed validator sharing the active one's moniker.
      validator('valOldJailed', 'blaze.apps', 'BOND_STATUS_UNBONDED'),
    ])
  vi.mocked(getNetInfoPeers).mockResolvedValue([
    // Node monikers are matched case-insensitively; h4lab is no validator.
    { moniker: 'Blaze.Apps', ip: '62.169.19.142' },
    { moniker: 'h4lab', ip: '146.0.73.247' },
  ])
  vi.mocked(getRpcSelfNode).mockResolvedValue({ moniker: 'blazed007', ip: '57.131.13.43' })
  vi.mocked(lookupCountry).mockImplementation(async (ip) => COUNTRY_BY_IP[ip] ?? null)
})

describe('refreshNodeLocations', () => {
  it('locates peers and the RPC node itself by moniker, leaving the rest unset', async () => {
    await refreshNodeLocations(db, tmClient)

    expect(await locationOf('valPeer')).toMatchObject({ countryCode: 'FR', countryName: 'France' })
    expect(await locationOf('valSelf')).toMatchObject({ countryCode: 'IT', countryName: 'Italy' })
    expect(await locationOf('valAbsent')).toBeUndefined()
  })

  it("doesn't give a non-bonded validator the node of a bonded one with the same moniker", async () => {
    await refreshNodeLocations(db, tmClient)

    expect(await locationOf('valOldJailed')).toBeUndefined()
  })

  it('keeps the last-seen country when a node drops out of the peer list', async () => {
    await refreshNodeLocations(db, tmClient)
    vi.mocked(getNetInfoPeers).mockResolvedValue([])
    vi.mocked(getRpcSelfNode).mockResolvedValue(null)

    await refreshNodeLocations(db, tmClient)

    expect(await locationOf('valPeer')).toMatchObject({ countryCode: 'FR' })
  })

  it('never stores a node IP', async () => {
    await refreshNodeLocations(db, tmClient)

    const docs = await db.collection(VALIDATORS_COLLECTION).find().toArray()
    expect(JSON.stringify(docs)).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/)
  })
})

describe('GET /api/validators nodeLocation', () => {
  it('returns the country (no IP), or null when unlocated', async () => {
    await refreshNodeLocations(db, tmClient)
    const app = await buildServer({ db, tmClient })

    const response = await app.inject({ method: 'GET', url: '/api/validators' })
    const byAddress = new Map(
      (response.json() as Paginated<ValidatorSummary>).data.map((v) => [
        v.operatorAddress,
        v,
      ])
    )

    expect(byAddress.get('valPeer')?.nodeLocation).toMatchObject({
      countryCode: 'FR',
      countryName: 'France',
      seenAt: expect.any(String),
    })
    expect(byAddress.get('valAbsent')?.nodeLocation).toBeNull()
    expect(byAddress.get('valOldJailed')?.nodeLocation).toBeNull()
    expect(response.body).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/)

    await app.close()
  })
})
