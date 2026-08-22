import type { FastifyInstance } from 'fastify'
import { fromBase64 } from '@cosmjs/encoding'
import type {
  Coin,
  ValidatorDetailResponse,
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
  querySigningInfo,
  queryValidatorCommission,
  queryValidatorOutstandingRewards,
} from '../chain/abci'
import { pubkeyToValconsAddress } from '../chain/helpers'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'
import type { Db } from 'mongodb'
import { TtlCache } from '../utils/ttlCache'

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
    if (doc.consensusPubkey) {
      const parsed = JSON.parse(doc.consensusPubkey) as {
        typeUrl: string
        value: string
      }
      const consAddress = pubkeyToValconsAddress(
        { typeUrl: parsed.typeUrl, value: fromBase64(parsed.value) },
        doc.operatorAddress
      )
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
      const identity = request.params.identity
      const doc = await collection.findOne({
        $or: [
          { identity },
          { moniker: identity },
          { operatorAddress: identity },
        ],
      })
      if (!doc) {
        return reply.status(404).send({ error: 'Validator not found' })
      }

      const [bondedDocs, bondDenom, uptime, rewards] = await Promise.all([
        collection.find({ status: 'BOND_STATUS_BONDED' }).toArray(),
        getBondDenom(db),
        resolveUptime(db, tmClient, doc),
        resolveRewards(tmClient, doc.operatorAddress),
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
      }
      return response
    }
  )
}
