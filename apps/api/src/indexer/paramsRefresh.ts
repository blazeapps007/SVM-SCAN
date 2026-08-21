import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import type { BridgeParams, OracleParams } from '@dexplorer/shared'
import { env } from '../config/env'
import {
  queryStakingParams,
  queryMintParams,
  queryDistributionParams,
  querySlashingParams,
  queryGovParams,
} from '../chain/abci'
import { fetchBridgeParams } from '../chain/steembridgeLcd'
import { fetchOracleParams } from '../chain/oracleLcd'
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

  // steembridge/oracledata are separate custom modules with no proto/ABCI
  // path — queried over LCD (see steembridgeLcd.ts/oracleLcd.ts) — so they're
  // simply unavailable when STEEMBRIDGE_LCD_URL isn't set, same gating as the
  // bridge deposit/withdrawal/name-service features.
  if (env.STEEMBRIDGE_LCD_URL) {
    const lcdUrl = env.STEEMBRIDGE_LCD_URL
    sources.push(
      {
        key: 'bridge',
        fetch: async (): Promise<BridgeParams> => {
          const raw = await fetchBridgeParams(lcdUrl)
          return {
            bridgeEnabled: raw.bridge_enabled,
            bridgeOutEnabled: raw.bridge_out_enabled,
            gatewayAccount: raw.gateway_account,
            bridgeConfirmationThreshold: raw.bridge_confirmation_threshold,
            minimumBridgeAmount: raw.minimum_bridge_amount,
            maximumBridgeAmount: raw.maximum_bridge_amount,
            depositTimeoutBlocks: raw.deposit_timeout_blocks,
            nameServiceEnabled: raw.name_service_enabled,
            nameRegistrationMinMillisteem:
              raw.name_registration_min_millisteem,
            namePendingTimeoutBlocks: raw.name_pending_timeout_blocks,
            relayerStartBlock: raw.relayer_start_block,
            bridgeFeeBps: raw.bridge_fee_bps,
            withdrawalTimeoutBlocks: raw.withdrawal_timeout_blocks,
          }
        },
      },
      {
        key: 'oracle',
        fetch: async (): Promise<OracleParams> => {
          const raw = await fetchOracleParams(lcdUrl)
          return {
            votePeriod: raw.vote_period,
            voteThreshold: raw.vote_threshold,
            rewardBand: raw.reward_band,
            missBand: raw.miss_band,
            whitelist: raw.whitelist,
          }
        },
      }
    )
  }

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
