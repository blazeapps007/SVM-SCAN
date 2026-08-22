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

// cosmjs-types decodes some ABCI Params fields as raw `bigint`/`Uint8Array` —
// neither is JSON-safe (bigint can't be JSON.stringify'd at all; Uint8Array
// serializes to a byte-array/Buffer-shaped object, not the string the
// frontend expects). Passing these straight from the ABCI decode into Mongo
// (as the other sources below still do, since their fields are already
// plain strings/numbers) previously left the values silently mangled — the
// frontend saw the wrong shape and rendered "NaN". Converting to plain
// strings here, once, before storage avoids depending on how those non-JSON
// types happen to survive a Mongo/JSON round-trip.
//
// decodeDecBytes is a pure byte->ASCII decode, not a value reinterpretation:
// the bytes already are LegacyDec.Marshal()'s raw scaled-integer digit
// string (e.g. "500000000000000000" for 0.5) — the same convention every
// other ABCI-decoded Dec field in this codebase uses (see
// decodeLegacyDecString in packages/shared) — NOT the human "0.5"-style
// string LCD/REST returns for the same value via its own, different
// MarshalJSON serialization. apps/web's convertRateToPercent (not
// formatDecPercent, which is for the LCD/REST form) still does the /10^16
// rescale on the frontend.
function decodeDecBytes(value: Uint8Array | string): string {
  return typeof value === 'string' ? value : Buffer.from(value).toString('utf8')
}

function toDurationShape(
  duration: { seconds: bigint; nanos: number } | undefined
): { seconds: string; nanos: number } {
  return { seconds: (duration?.seconds ?? 0n).toString(), nanos: duration?.nanos ?? 0 }
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
      fetch: async () => {
        const raw = (await queryStakingParams(tmClient)).params
        if (!raw) return {}
        // unbondingTime is a Duration (bigint seconds) — see decodeDecBytes'
        // doc comment for why that can't be stored/returned as-is.
        return { ...raw, unbondingTime: toDurationShape(raw.unbondingTime) }
      },
    },
    {
      key: 'mint',
      fetch: async () => {
        const raw = (await queryMintParams(tmClient)).params
        if (!raw) return {}
        // blocksPerYear is a bigint — same reasoning as decodeDecBytes.
        return { ...raw, blocksPerYear: raw.blocksPerYear?.toString() ?? '0' }
      },
    },
    {
      key: 'distribution',
      fetch: async () => (await queryDistributionParams(tmClient)).params,
    },
    {
      key: 'slashing',
      fetch: async () => {
        const raw = (await querySlashingParams(tmClient)).params
        if (!raw) return {}
        return {
          signedBlocksWindow: raw.signedBlocksWindow?.toString() ?? '0',
          minSignedPerWindow: decodeDecBytes(raw.minSignedPerWindow),
          downtimeJailDuration: toDurationShape(raw.downtimeJailDuration),
          slashFractionDoubleSign: decodeDecBytes(raw.slashFractionDoubleSign),
          slashFractionDowntime: decodeDecBytes(raw.slashFractionDowntime),
        }
      },
    },
    {
      key: 'govVoting',
      fetch: async () => {
        const raw = (await queryGovParams(tmClient, 'voting')).votingParams
        if (!raw) return {}
        // votingPeriod is a Duration (bigint seconds) — same JSON-safety
        // issue as staking's unbondingTime, see decodeDecBytes' doc comment.
        return { ...raw, votingPeriod: toDurationShape(raw.votingPeriod) }
      },
    },
    {
      key: 'govDeposit',
      fetch: async () => {
        const raw = (await queryGovParams(tmClient, 'deposit')).depositParams
        if (!raw) return {}
        return {
          ...raw,
          maxDepositPeriod: toDurationShape(raw.maxDepositPeriod),
        }
      },
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
