import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import {
  queryStakingParams,
  queryMintParams,
  queryDistributionParams,
  querySlashingParams,
  queryGovParams,
} from '../chain/abci'
import {
  CHAIN_PARAMS_COLLECTION,
  ChainParamsDoc,
} from '../db/schemas/chainParams.schema'

async function upsertParams(
  db: Db,
  key: string,
  params: unknown
): Promise<void> {
  const doc: ChainParamsDoc = { _id: key, params, updatedAt: new Date() }
  await db
    .collection<ChainParamsDoc>(CHAIN_PARAMS_COLLECTION)
    .updateOne({ _id: key }, { $set: doc }, { upsert: true })
}

interface ParamSource {
  key: string
  fetch: () => Promise<unknown>
}

export async function refreshParams(
  db: Db,
  tmClient: Tendermint37Client
): Promise<void> {
  // Cosmos SDK's gov v1 Query/Params expects the short form ("voting",
  // "deposit", "tallying"), not the legacy v1beta1-style "*_params" names.
  const sources: ParamSource[] = [
    {
      key: 'staking',
      fetch: async () => (await queryStakingParams(tmClient)).params,
    },
    {
      key: 'mint',
      fetch: async () => (await queryMintParams(tmClient)).params,
    },
    {
      key: 'distribution',
      fetch: async () => (await queryDistributionParams(tmClient)).params,
    },
    {
      key: 'slashing',
      fetch: async () => (await querySlashingParams(tmClient)).params,
    },
    {
      key: 'govVoting',
      fetch: async () =>
        (await queryGovParams(tmClient, 'voting')).votingParams,
    },
    {
      key: 'govDeposit',
      fetch: async () =>
        (await queryGovParams(tmClient, 'deposit')).depositParams,
    },
    {
      key: 'govTally',
      fetch: async () =>
        (await queryGovParams(tmClient, 'tallying')).tallyParams,
    },
  ]

  // Each module is fetched/persisted independently — one unsupported or
  // failing module (e.g. a chain without the slashing module) must not
  // discard params that were successfully fetched for the others.
  const results = await Promise.allSettled(
    sources.map(async ({ key, fetch }) => {
      const params = await fetch()
      await upsertParams(db, key, params ?? {})
    })
  )

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(
        `Failed to refresh "${sources[i].key}" params:`,
        result.reason
      )
    }
  })
}
