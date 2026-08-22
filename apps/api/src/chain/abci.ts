import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { QueryClient } from '@cosmjs/stargate'
import { PageRequest } from 'cosmjs-types/cosmos/base/query/v1beta1/pagination'
import {
  QueryValidatorsRequest,
  QueryValidatorsResponse,
  QueryPoolRequest,
  QueryPoolResponse,
  QueryParamsRequest as QueryStakingParamsRequest,
  QueryParamsResponse as QueryStakingParamsResponse,
} from 'cosmjs-types/cosmos/staking/v1beta1/query'
import {
  QueryParamsRequest as QueryMintParamsRequest,
  QueryParamsResponse as QueryMintParamsResponse,
} from 'cosmjs-types/cosmos/mint/v1beta1/query'
import {
  QueryProposalsRequest,
  QueryProposalsResponse,
  QueryProposalRequest,
  QueryProposalResponse,
  QueryParamsRequest as QueryGovParamsRequest,
  QueryParamsResponse as QueryGovParamsResponse,
  QueryTallyResultRequest,
  QueryTallyResultResponse,
} from 'cosmjs-types/cosmos/gov/v1/query'
import {
  QueryParamsRequest as QueryDistributionParamsRequest,
  QueryParamsResponse as QueryDistributionParamsResponse,
  QueryValidatorOutstandingRewardsRequest,
  QueryValidatorOutstandingRewardsResponse,
  QueryValidatorCommissionRequest,
  QueryValidatorCommissionResponse,
} from 'cosmjs-types/cosmos/distribution/v1beta1/query'
import {
  QueryParamsRequest as QuerySlashingParamsRequest,
  QueryParamsResponse as QuerySlashingParamsResponse,
  QuerySigningInfoRequest,
  QuerySigningInfoResponse,
} from 'cosmjs-types/cosmos/slashing/v1beta1/query'
import {
  QueryDenomsMetadataRequest,
  QueryDenomsMetadataResponse,
} from 'cosmjs-types/cosmos/bank/v1beta1/query'
import { QueryDenomTraceRequest } from 'cosmjs-types/ibc/applications/transfer/v1/query'
import { BinaryReader } from 'cosmjs-types/binary'
import { withChainTimeout } from './connectionHealth'

// Cache QueryClient instances per Tendermint37Client to avoid creating a new one for every query
const queryClientCache = new WeakMap<Tendermint37Client, QueryClient>()

function getQueryClient(tmClient: Tendermint37Client): QueryClient {
  if (!queryClientCache.has(tmClient)) {
    const client = new QueryClient(tmClient)
    // Every function in this file goes through client.queryAbci — wrapping
    // it once here applies the timeout everywhere without touching each
    // call site individually.
    const rawQueryAbci = client.queryAbci.bind(client)
    client.queryAbci = (path, data) =>
      withChainTimeout(rawQueryAbci(path, data), path)
    queryClientCache.set(tmClient, client)
  }
  return queryClientCache.get(tmClient)!
}

export async function queryActiveValidators(
  tmClient: Tendermint37Client,
  page: number,
  perPage: number
): Promise<QueryValidatorsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryValidatorsRequest.encode({
    status: 'BOND_STATUS_BONDED',
    pagination: PageRequest.fromJSON({
      offset: page * perPage,
      limit: perPage,
      countTotal: true,
    }),
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.staking.v1beta1.Query/Validators',
    req
  )
  return QueryValidatorsResponse.decode(value)
}

export async function queryValidators(
  tmClient: Tendermint37Client,
  page: number,
  perPage: number
): Promise<QueryValidatorsResponse> {
  const queryClient = getQueryClient(tmClient)
  const validatorsRequest = QueryValidatorsRequest.fromPartial({
    pagination: PageRequest.fromJSON({
      offset: page * perPage,
      limit: perPage,
      countTotal: true,
    }),
  })
  const req = QueryValidatorsRequest.encode(validatorsRequest).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.staking.v1beta1.Query/Validators',
    req
  )
  return QueryValidatorsResponse.decode(value)
}

export async function queryStakingPool(
  tmClient: Tendermint37Client
): Promise<QueryPoolResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryPoolRequest.encode({}).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.staking.v1beta1.Query/Pool',
    req
  )
  return QueryPoolResponse.decode(value)
}

export async function queryProposals(
  tmClient: Tendermint37Client,
  page: number,
  perPage: number
): Promise<QueryProposalsResponse> {
  const queryClient = getQueryClient(tmClient)
  const proposalsRequest = QueryProposalsRequest.fromPartial({
    pagination: PageRequest.fromJSON({
      offset: page * perPage,
      limit: perPage,
      countTotal: true,
      reverse: true,
    }),
  })
  const req = QueryProposalsRequest.encode(proposalsRequest).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.gov.v1.Query/Proposals',
    req
  )
  return QueryProposalsResponse.decode(value)
}

export async function queryProposalById(
  tmClient: Tendermint37Client,
  proposalId: number
): Promise<QueryProposalResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryProposalRequest.encode({
    proposalId: BigInt(proposalId),
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.gov.v1.Query/Proposal',
    req
  )
  return QueryProposalResponse.decode(value)
}

// `Proposal.finalTallyResult` is only populated once voting has concluded —
// for an in-progress proposal it's all zeros. `Query/TallyResult` computes
// the current tally on demand by summing live votes (this is what
// `<chaind> query gov tally <id>` uses), so it must be used instead while a
// proposal is still in its deposit/voting period.
export async function queryTallyResult(
  tmClient: Tendermint37Client,
  proposalId: number
): Promise<QueryTallyResultResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryTallyResultRequest.encode({
    proposalId: BigInt(proposalId),
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.gov.v1.Query/TallyResult',
    req
  )
  return QueryTallyResultResponse.decode(value)
}

export async function queryStakingParams(
  tmClient: Tendermint37Client
): Promise<QueryStakingParamsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryStakingParamsRequest.encode({}).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.staking.v1beta1.Query/Params',
    req
  )
  return QueryStakingParamsResponse.decode(value)
}

export async function queryMintParams(
  tmClient: Tendermint37Client
): Promise<QueryMintParamsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryMintParamsRequest.encode({}).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.mint.v1beta1.Query/Params',
    req
  )
  return QueryMintParamsResponse.decode(value)
}

export async function queryGovParams(
  tmClient: Tendermint37Client,
  paramsType: string
): Promise<QueryGovParamsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryGovParamsRequest.encode({
    paramsType: paramsType,
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.gov.v1.Query/Params',
    req
  )
  return QueryGovParamsResponse.decode(value)
}

export async function queryDistributionParams(
  tmClient: Tendermint37Client
): Promise<QueryDistributionParamsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryDistributionParamsRequest.encode({}).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.distribution.v1beta1.Query/Params',
    req
  )
  return QueryDistributionParamsResponse.decode(value)
}

// Un-withdrawn rewards accrued for a validator (split between its
// delegators and the validator's own commission cut) — changes every block,
// so this is queried live rather than indexed/refreshed on a timer, the
// same "live current-state" reasoning as account balances.
export async function queryValidatorOutstandingRewards(
  tmClient: Tendermint37Client,
  validatorAddress: string
): Promise<QueryValidatorOutstandingRewardsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryValidatorOutstandingRewardsRequest.encode({
    validatorAddress,
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.distribution.v1beta1.Query/ValidatorOutstandingRewards',
    req
  )
  return QueryValidatorOutstandingRewardsResponse.decode(value)
}

// The validator's own accumulated commission — a subset of
// ValidatorOutstandingRewards above (that query includes delegator rewards
// too), i.e. what the validator itself would receive on withdrawal.
export async function queryValidatorCommission(
  tmClient: Tendermint37Client,
  validatorAddress: string
): Promise<QueryValidatorCommissionResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryValidatorCommissionRequest.encode({
    validatorAddress,
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.distribution.v1beta1.Query/ValidatorCommission',
    req
  )
  return QueryValidatorCommissionResponse.decode(value)
}

export async function querySlashingParams(
  tmClient: Tendermint37Client
): Promise<QuerySlashingParamsResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QuerySlashingParamsRequest.encode({}).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.slashing.v1beta1.Query/Params',
    req
  )
  return QuerySlashingParamsResponse.decode(value)
}

export async function querySigningInfo(
  tmClient: Tendermint37Client,
  consAddress: string
): Promise<QuerySigningInfoResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QuerySigningInfoRequest.encode({ consAddress }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.slashing.v1beta1.Query/SigningInfo',
    req
  )
  return QuerySigningInfoResponse.decode(value)
}

export async function queryDenomsMetadata(
  tmClient: Tendermint37Client,
  page: number,
  perPage: number
): Promise<QueryDenomsMetadataResponse> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryDenomsMetadataRequest.encode({
    pagination: PageRequest.fromJSON({
      offset: page * perPage,
      limit: perPage,
      countTotal: true,
    }),
  }).finish()
  const { value } = await queryClient.queryAbci(
    '/cosmos.bank.v1beta1.Query/DenomsMetadata',
    req
  )
  return QueryDenomsMetadataResponse.decode(value)
}

export interface IbcDenomInfo {
  baseDenom: string
  path: string
}

// ibc-go v8+ renamed the transfer module's DenomTrace query to Denom, and
// restructured the response from DenomTrace{path, baseDenom} to
// Denom{base, trace: repeated Hop{portId, channelId}}. cosmjs-types@0.9.0
// only ships the old shape, so this is a minimal hand decoder for the new
// one — verified against a live query on this chain (decoded word-by-word
// against a known "uosmo" transfer over channel-3), not assumed from spec.
// The request encoding is unchanged between versions (just a `hash` string
// field), so QueryDenomTraceRequest is still used for that part.
export async function queryIbcDenom(
  tmClient: Tendermint37Client,
  hash: string
): Promise<IbcDenomInfo | null> {
  const queryClient = getQueryClient(tmClient)
  const req = QueryDenomTraceRequest.encode({ hash }).finish()
  const { value } = await queryClient.queryAbci(
    '/ibc.applications.transfer.v1.Query/Denom',
    req
  )

  const reader = new BinaryReader(value)
  const end = reader.len
  let baseDenom = ''
  const hops: string[] = []

  while (reader.pos < end) {
    const tag = reader.uint32()
    if (tag >>> 3 !== 1 || (tag & 7) !== 2) {
      reader.skipType(tag & 7)
      continue
    }

    const denomReader = new BinaryReader(reader.bytes())
    const denomEnd = denomReader.len
    while (denomReader.pos < denomEnd) {
      const innerTag = denomReader.uint32()
      const innerField = innerTag >>> 3
      const innerWire = innerTag & 7

      if (innerField === 1 && innerWire === 2) {
        baseDenom = denomReader.string()
      } else if (innerField === 3 && innerWire === 2) {
        const hopReader = new BinaryReader(denomReader.bytes())
        const hopEnd = hopReader.len
        let portId = ''
        let channelId = ''
        while (hopReader.pos < hopEnd) {
          const hopTag = hopReader.uint32()
          const hopField = hopTag >>> 3
          const hopWire = hopTag & 7
          if (hopField === 1 && hopWire === 2) portId = hopReader.string()
          else if (hopField === 2 && hopWire === 2)
            channelId = hopReader.string()
          else hopReader.skipType(hopWire)
        }
        hops.push(`${portId}/${channelId}`)
      } else {
        denomReader.skipType(innerWire)
      }
    }
  }

  if (!baseDenom) return null
  return { baseDenom, path: hops.join('/') }
}
