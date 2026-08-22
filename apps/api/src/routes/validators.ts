import type { FastifyInstance } from 'fastify'
import { fromBase64 } from '@cosmjs/encoding'
import type {
  Coin,
  ValidatorAttestation,
  ValidatorDetailResponse,
  ValidatorOracleSubmission,
  ValidatorStats,
  ValidatorSummary,
} from '@dexplorer/shared'
import { decodeLegacyDecString } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  VALIDATORS_COLLECTION,
  ValidatorDoc,
} from '../db/schemas/validator.schema'
import {
  CHAIN_PARAMS_COLLECTION,
  ChainParamsDoc,
} from '../db/schemas/chainParams.schema'
import {
  REWARD_CLAIMS_COLLECTION,
  RewardClaimDoc,
} from '../db/schemas/rewardClaim.schema'
import {
  BRIDGE_DEPOSITS_COLLECTION,
  BridgeDepositDoc,
} from '../db/schemas/bridgeDeposit.schema'
import {
  BRIDGE_WITHDRAWALS_COLLECTION,
  BridgeWithdrawalDoc,
} from '../db/schemas/bridgeWithdrawal.schema'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import {
  querySigningInfo,
  queryValidatorCommission,
  queryValidatorOutstandingRewards,
} from '../chain/abci'
import {
  pubkeyToValconsAddress,
  valoperToAccountAddress,
} from '../chain/helpers'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'
import type { Db } from 'mongodb'
import { TtlCache } from '../utils/ttlCache'

const ORACLE_MESSAGE_TYPES: Record<string, 'vote' | 'prevote'> = {
  '/steemvm.oracle.data.v1.MsgAggregateExchangeRateVote': 'vote',
  '/steemvm.oracle.data.v1.MsgAggregateExchangeRatePrevote': 'prevote',
}

// resolveUptime needs this validator's bech32 valcons address (for the ABCI
// querySigningInfo call) — derived from its consensusPubkey, not stored
// directly. (Resolving a block's *hex* proposer_address to a validator is a
// different lookup — see ValidatorDoc.consAddressHex / db/validatorLookup.ts.)
function getConsAddress(doc: ValidatorDoc): string | null {
  if (!doc.consensusPubkey) return null
  try {
    const parsed = JSON.parse(doc.consensusPubkey) as {
      typeUrl: string
      value: string
    }
    return pubkeyToValconsAddress(
      { typeUrl: parsed.typeUrl, value: fromBase64(parsed.value) },
      doc.operatorAddress
    )
  } catch {
    return null
  }
}

const uptimeCache = new TtlCache<ValidatorDetailResponse['uptime']>(60_000)

interface RewardsResult {
  pendingRewards: Coin[] | null
  accumulatedCommission: Coin[] | null
}

const rewardsCache = new TtlCache<RewardsResult>(15_000)

function toSummary(
  doc: ValidatorDoc,
  totalBondedTokens: number,
  bondDenom: string
): ValidatorSummary {
  const tokens = Number(doc.tokens) || 0
  return {
    operatorAddress: doc.operatorAddress,
    moniker: doc.moniker,
    identity: doc.identity,
    status: doc.status,
    jailed: doc.jailed,
    tokens: doc.tokens,
    bondDenom,
    commissionRate: doc.commissionRate,
    votingPowerPercent:
      totalBondedTokens > 0 ? (tokens / totalBondedTokens) * 100 : 0,
  }
}

async function getBondDenom(db: Db): Promise<string> {
  const stakingParams = await db
    .collection<ChainParamsDoc>(CHAIN_PARAMS_COLLECTION)
    .findOne({ _id: 'staking' })
  const params = stakingParams?.params as Record<string, unknown> | undefined
  return (params?.bondDenom as string | undefined) ?? ''
}

async function getTotalRewardsClaimed(
  db: Db,
  operatorAddress: string
): Promise<Coin[]> {
  return db
    .collection<RewardClaimDoc>(REWARD_CLAIMS_COLLECTION)
    .aggregate<Coin>([
      { $match: { validatorAddress: operatorAddress } },
      { $unwind: '$amount' },
      {
        $group: {
          _id: '$amount.denom',
          // $toDecimal avoids float precision loss summing these
          // string-encoded atto amounts, same reasoning as the bridge
          // stats aggregations.
          sum: { $sum: { $toDecimal: '$amount.amount' } },
        },
      },
      { $project: { _id: 0, denom: '$_id', amount: { $toString: '$sum' } } },
      { $sort: { denom: 1 } },
    ])
    .toArray()
}

const ATTESTATION_LIMIT = 20

async function getAttestations(
  db: Db,
  operatorAddress: string
): Promise<ValidatorAttestation[]> {
  const [depositDocs, withdrawalDocs] = await Promise.all([
    db
      .collection<BridgeDepositDoc>(BRIDGE_DEPOSITS_COLLECTION)
      .find({ 'validatorConfirmations.validatorAddress': operatorAddress })
      .sort({ idNum: -1 })
      .limit(ATTESTATION_LIMIT)
      .toArray(),
    db
      .collection<BridgeWithdrawalDoc>(BRIDGE_WITHDRAWALS_COLLECTION)
      .find({ 'validatorConfirmations.validatorAddress': operatorAddress })
      .sort({ idNum: -1 })
      .limit(ATTESTATION_LIMIT)
      .toArray(),
  ])

  const deposits: ValidatorAttestation[] = depositDocs.map((deposit) => ({
    type: 'deposit',
    id: deposit.id,
    txRef: deposit.txid,
    asset: deposit.asset,
    amountMillisteem: deposit.amountMillisteem,
    status: deposit.status,
    confirmedAt:
      deposit.validatorConfirmations.find(
        (c) => c.validatorAddress === operatorAddress
      )?.timestamp ?? '0',
  }))

  const withdrawals: ValidatorAttestation[] = withdrawalDocs.map(
    (withdrawal) => ({
      type: 'withdrawal',
      id: withdrawal.id,
      txRef: withdrawal.burnTxHash,
      asset: withdrawal.asset,
      amountMillisteem: withdrawal.amountMillisteem,
      status: withdrawal.status,
      confirmedAt:
        withdrawal.validatorConfirmations.find(
          (c) => c.validatorAddress === operatorAddress
        )?.timestamp ?? '0',
    })
  )

  return [...deposits, ...withdrawals]
    .sort((a, b) => Number(b.confirmedAt) - Number(a.confirmedAt))
    .slice(0, ATTESTATION_LIMIT)
}

const ORACLE_SUBMISSION_LIMIT = 20

async function getOracleSubmissions(
  db: Db,
  operatorAddress: string
): Promise<ValidatorOracleSubmission[]> {
  const accountAddress = valoperToAccountAddress(operatorAddress)
  if (!accountAddress) return []

  const docs = await db
    .collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
    .find({
      senders: accountAddress,
      messageTypes: { $in: Object.keys(ORACLE_MESSAGE_TYPES) },
    })
    .sort({ height: -1 })
    .limit(ORACLE_SUBMISSION_LIMIT)
    .toArray()

  return docs.map((tx) => {
    const oracleType = tx.messageTypes.find((t) => t in ORACLE_MESSAGE_TYPES)
    return {
      hash: tx.hash,
      height: tx.height,
      timestamp: tx.timestamp.toISOString(),
      success: tx.code === 0,
      kind: oracleType ? ORACLE_MESSAGE_TYPES[oracleType] : 'vote',
    }
  })
}

async function resolveUptime(
  db: Db,
  tmClient: AppContext['tmClient'],
  doc: ValidatorDoc
): Promise<ValidatorDetailResponse['uptime']> {
  const cached = uptimeCache.get(doc.operatorAddress)
  if (cached !== undefined) {
    return cached
  }

  let uptime: ValidatorDetailResponse['uptime'] = null
  try {
    const consAddress = getConsAddress(doc)
    if (consAddress) {
      const [signingInfo, slashingParams] = await Promise.all([
        querySigningInfo(tmClient, consAddress),
        db
          .collection<ChainParamsDoc>(CHAIN_PARAMS_COLLECTION)
          .findOne({ _id: 'slashing' }),
      ])
      if (signingInfo.valSigningInfo) {
        const slashingParamsValue = slashingParams?.params as
          | Record<string, unknown>
          | undefined
        const signedBlocksWindow = slashingParamsValue?.signedBlocksWindow
        uptime = {
          missedBlocksCounter:
            signingInfo.valSigningInfo.missedBlocksCounter.toString(),
          signedBlocksWindow: signedBlocksWindow
            ? String(signedBlocksWindow)
            : '0',
        }
      }
    }
  } catch {
    uptime = null
  }

  uptimeCache.set(doc.operatorAddress, uptime)
  return uptime
}

async function resolveRewards(
  tmClient: AppContext['tmClient'],
  operatorAddress: string
): Promise<RewardsResult> {
  const cached = rewardsCache.get(operatorAddress)
  if (cached) {
    return cached
  }

  let result: RewardsResult = {
    pendingRewards: null,
    accumulatedCommission: null,
  }
  try {
    const [rewardsResponse, commissionResponse] = await Promise.all([
      queryValidatorOutstandingRewards(tmClient, operatorAddress),
      queryValidatorCommission(tmClient, operatorAddress),
    ])
    // Both responses' amounts are DecCoins — the raw ABCI-decoded digit
    // string is the LegacyDec wire encoding (value * 10^18), not yet the
    // human-decimal Dec value, exactly like delegatorShares.
    result = {
      pendingRewards: (rewardsResponse.rewards?.rewards ?? []).map(
        (coin) => ({
          denom: coin.denom,
          amount: decodeLegacyDecString(coin.amount),
        })
      ),
      accumulatedCommission: (
        commissionResponse.commission?.commission ?? []
      ).map((coin) => ({
        denom: coin.denom,
        amount: decodeLegacyDecString(coin.amount),
      })),
    }
  } catch {
    result = { pendingRewards: null, accumulatedCommission: null }
  }

  rewardsCache.set(operatorAddress, result)
  return result
}

export function registerValidatorRoutes(
  app: FastifyInstance,
  { db, tmClient }: AppContext
): void {
  const collection = db.collection<ValidatorDoc>(VALIDATORS_COLLECTION)

  function findValidatorDoc(identity: string) {
    return collection.findOne({
      $or: [
        { identity },
        { moniker: identity },
        { operatorAddress: identity },
      ],
    })
  }

  app.get<{ Querystring: PageQuery & { status?: string } }>(
    '/validators',
    async (request) => {
      const { page, perPage, skip } = parsePagination(request.query, 100)
      const filter =
        request.query.status === 'active'
          ? { status: 'BOND_STATUS_BONDED' }
          : {}

      const [docs, total, bondedDocs, bondDenom] = await Promise.all([
        collection
          .find(filter)
          .sort({ tokens: -1 })
          .skip(skip)
          .limit(perPage)
          .toArray(),
        collection.countDocuments(filter),
        collection.find({ status: 'BOND_STATUS_BONDED' }).toArray(),
        getBondDenom(db),
      ])

      const totalBondedTokens = bondedDocs.reduce(
        (sum, v) => sum + (Number(v.tokens) || 0),
        0
      )
      return paginatedResponse(
        docs.map((doc) => toSummary(doc, totalBondedTokens, bondDenom)),
        page,
        perPage,
        total
      )
    }
  )

  app.get('/validators/stats', async (): Promise<ValidatorStats> => {
    const [activeCount, totalCount, bondedDocs] = await Promise.all([
      collection.countDocuments({ status: 'BOND_STATUS_BONDED' }),
      collection.countDocuments({}),
      collection.find({ status: 'BOND_STATUS_BONDED' }).toArray(),
    ])

    const avgCommission =
      bondedDocs.length > 0
        ? bondedDocs.reduce(
            (sum, v) => sum + (Number(v.commissionRate) || 0),
            0
          ) /
          bondedDocs.length /
          1e16
        : 0

    return { activeCount, totalCount, avgCommission }
  })

  app.get<{ Params: { identity: string } }>(
    '/validators/:identity',
    async (request, reply) => {
      const doc = await findValidatorDoc(request.params.identity)
      if (!doc) {
        return reply.status(404).send({ error: 'Validator not found' })
      }

      const [bondedDocs, bondDenom, uptime, rewards, totalRewardsClaimed] =
        await Promise.all([
          collection.find({ status: 'BOND_STATUS_BONDED' }).toArray(),
          getBondDenom(db),
          resolveUptime(db, tmClient, doc),
          resolveRewards(tmClient, doc.operatorAddress),
          getTotalRewardsClaimed(db, doc.operatorAddress),
        ])
      const totalBondedTokens = bondedDocs.reduce(
        (sum, v) => sum + (Number(v.tokens) || 0),
        0
      )

      const response: ValidatorDetailResponse = {
        ...toSummary(doc, totalBondedTokens, bondDenom),
        website: doc.website,
        details: doc.details,
        delegatorShares: doc.delegatorShares,
        minSelfDelegation: doc.minSelfDelegation,
        unbondingHeight: doc.unbondingHeight,
        consensusPubkey: doc.consensusPubkey,
        uptime,
        pendingRewards: rewards.pendingRewards,
        accumulatedCommission: rewards.accumulatedCommission,
        totalRewardsClaimed,
      }
      return response
    }
  )

  app.get<{ Params: { identity: string } }>(
    '/validators/:identity/attestations',
    async (request, reply) => {
      const doc = await findValidatorDoc(request.params.identity)
      if (!doc) {
        return reply.status(404).send({ error: 'Validator not found' })
      }
      return getAttestations(db, doc.operatorAddress)
    }
  )

  app.get<{ Params: { identity: string } }>(
    '/validators/:identity/oracle-submissions',
    async (request, reply) => {
      const doc = await findValidatorDoc(request.params.identity)
      if (!doc) {
        return reply.status(404).send({ error: 'Validator not found' })
      }
      return getOracleSubmissions(db, doc.operatorAddress)
    }
  )
}
