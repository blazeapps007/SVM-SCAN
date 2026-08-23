import type { FastifyInstance } from 'fastify'
import type {
  BridgeAssetTotal,
  BridgeParams,
  ChainParamsResponse,
  Coin,
  OracleParams,
  TokenomicsResponse,
} from '@dexplorer/shared'
import { decodeLegacyDecString } from '@dexplorer/shared'
import type { AppContext } from '../server'
import type { Db } from 'mongodb'
import {
  CHAIN_PARAMS_COLLECTION,
  ChainParamsDoc,
} from '../db/schemas/chainParams.schema'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import {
  BRIDGE_WITHDRAWALS_COLLECTION,
  BridgeWithdrawalDoc,
} from '../db/schemas/bridgeWithdrawal.schema'
import {
  REWARD_CLAIMS_COLLECTION,
  RewardClaimDoc,
} from '../db/schemas/rewardClaim.schema'
import {
  VALIDATORS_COLLECTION,
  ValidatorDoc,
} from '../db/schemas/validator.schema'
import { BLOCKS_COLLECTION, BlockDoc } from '../db/schemas/block.schema'
import { queryCommunityPool } from '../chain/abci'
import { TtlCache } from '../utils/ttlCache'

// $unwind + $group + $toDecimal (avoids float precision loss summing these
// big string-encoded atto amounts) over a { denom, amount } array field —
// the same shape used for tx fees, reward-claim amounts, and bridge
// withdrawal principal, so one pipeline builder covers all three.
function sumCoinArrayField(arrayField: string) {
  return [
    { $unwind: `$${arrayField}` },
    {
      $group: {
        _id: `$${arrayField}.denom`,
        sum: { $sum: { $toDecimal: `$${arrayField}.amount` } },
      },
    },
    { $project: { _id: 0, denom: '$_id', amount: { $toString: '$sum' } } },
    { $sort: { denom: 1 } },
  ]
}

async function getTotalTxFees(db: Db): Promise<Coin[]> {
  return db
    .collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
    .aggregate<Coin>(sumCoinArrayField('fee'))
    .toArray()
}

async function getTotalRewardsDistributed(db: Db): Promise<Coin[]> {
  return db
    .collection<RewardClaimDoc>(REWARD_CLAIMS_COLLECTION)
    .aggregate<Coin>(sumCoinArrayField('amount'))
    .toArray()
}

async function getTotalBridgeFees(db: Db): Promise<BridgeAssetTotal[]> {
  return db
    .collection<BridgeWithdrawalDoc>(BRIDGE_WITHDRAWALS_COLLECTION)
    .aggregate<BridgeAssetTotal>([
      {
        $group: {
          _id: '$asset',
          sum: { $sum: { $toDecimal: '$feeMillisteem' } },
        },
      },
      {
        $project: { _id: 0, asset: '$_id', amountMillisteem: { $toString: '$sum' } },
      },
      { $sort: { asset: 1 } },
    ])
    .toArray()
}

// Sums every block's `burned` field (this chain's STEEMBLACKHOLE EndBlock
// burn-sweep event, see indexer/burnEvents.ts) rather than deriving it from
// bridgeWithdrawals — STEEMBLACKHOLE is the chain's SOLE burn point
// (verified against the chain's own source), so this single aggregation
// already covers bridge-out net amounts *and* the 25% tx-fee-split burn
// (x/oracle/bridge/keeper/feesplit.go's SplitFees, every BeginBlock) with no
// double-counting. Blocks indexed before this field existed have no
// `burned` array and are skipped by $unwind — a full historical total needs
// those blocks re-indexed.
async function getTotalBurned(db: Db): Promise<Coin[]> {
  return db
    .collection<BlockDoc>(BLOCKS_COLLECTION)
    .aggregate<Coin>(sumCoinArrayField('burned'))
    .toArray()
}

async function getTotalStaked(db: Db): Promise<Coin[]> {
  const stakingParams = await db
    .collection<ChainParamsDoc>(CHAIN_PARAMS_COLLECTION)
    .findOne({ _id: 'staking' })
  const bondDenom =
    ((stakingParams?.params as Record<string, unknown> | undefined)
      ?.bondDenom as string | undefined) ?? 'asteem'

  const bondedDocs = await db
    .collection<ValidatorDoc>(VALIDATORS_COLLECTION)
    .find({ status: 'BOND_STATUS_BONDED' }, { projection: { tokens: 1 } })
    .toArray()

  const total = bondedDocs.reduce((sum, doc) => sum + BigInt(doc.tokens || '0'), 0n)
  return [{ denom: bondDenom, amount: total.toString() }]
}

async function getCommunityPool(
  tmClient: AppContext['tmClient']
): Promise<Coin[] | null> {
  try {
    const { pool } = await queryCommunityPool(tmClient)
    return pool.map((coin) => ({
      denom: coin.denom,
      amount: decodeLegacyDecString(coin.amount),
    }))
  } catch {
    return null
  }
}

const tokenomicsCache = new TtlCache<TokenomicsResponse>(60_000)

export function registerParamsRoutes(
  app: FastifyInstance,
  { db, tmClient }: AppContext
): void {
  app.get('/params', async (): Promise<ChainParamsResponse> => {
    const docs = await db
      .collection<ChainParamsDoc>(CHAIN_PARAMS_COLLECTION)
      .find()
      .toArray()

    const byId = new Map(
      docs.map((doc) => [
        doc._id,
        doc.params as Record<string, unknown> | undefined,
      ])
    )

    return {
      staking: byId.get('staking') ?? null,
      mint: byId.get('mint') ?? null,
      distribution: byId.get('distribution') ?? null,
      slashing: byId.get('slashing') ?? null,
      gov: {
        votingParams: byId.get('govVoting') ?? null,
        depositParams: byId.get('govDeposit') ?? null,
        tallyParams: byId.get('govTally') ?? null,
      },
      bridge: (byId.get('bridge') as BridgeParams | undefined) ?? null,
      oracle: (byId.get('oracle') as OracleParams | undefined) ?? null,
    }
  })

  // Combines several lifetime aggregates (cheap to compute individually, but
  // several full-collection $group passes add up) plus one live ABCI query
  // into a single cached response, rather than the frontend firing five
  // separate requests for one page section.
  app.get('/params/tokenomics', async (): Promise<TokenomicsResponse> => {
    const cached = tokenomicsCache.get('tokenomics')
    if (cached) return cached

    const [
      totalTxFees,
      totalBridgeFees,
      totalRewardsDistributed,
      totalStaked,
      totalBurned,
      communityPool,
    ] = await Promise.all([
      getTotalTxFees(db),
      getTotalBridgeFees(db),
      getTotalRewardsDistributed(db),
      getTotalStaked(db),
      getTotalBurned(db),
      getCommunityPool(tmClient),
    ])

    const response: TokenomicsResponse = {
      totalTxFees,
      totalBridgeFees,
      totalRewardsDistributed,
      totalStaked,
      totalBurned,
      communityPool,
    }
    tokenomicsCache.set('tokenomics', response)
    return response
  })
}
