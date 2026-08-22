import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import {
  MsgCommunityPoolSpend,
  MsgFundCommunityPool,
  MsgSetWithdrawAddress,
  MsgWithdrawDelegatorReward,
  MsgWithdrawValidatorCommission,
} from 'cosmjs-types/cosmos/distribution/v1beta1/tx'
import {
  MsgBeginRedelegate,
  MsgCancelUnbondingDelegation,
  MsgCreateValidator,
  MsgDelegate,
  MsgEditValidator,
  MsgUndelegate,
} from 'cosmjs-types/cosmos/staking/v1beta1/tx'
import {
  MsgCreateClient,
  MsgUpdateClient,
} from 'cosmjs-types/ibc/core/client/v1/tx'
import {
  MsgConnectionOpenAck,
  MsgConnectionOpenConfirm,
  MsgConnectionOpenInit,
  MsgConnectionOpenTry,
} from 'cosmjs-types/ibc/core/connection/v1/tx'
import { MsgSoftwareUpgrade } from 'cosmjs-types/cosmos/upgrade/v1beta1/tx'
import {
  MsgAcknowledgement,
  MsgChannelCloseConfirm,
  MsgChannelCloseInit,
  MsgChannelOpenAck,
  MsgChannelOpenConfirm,
  MsgChannelOpenInit,
  MsgChannelOpenTry,
  MsgRecvPacket,
  MsgTimeout,
  MsgTimeoutOnClose,
} from 'cosmjs-types/ibc/core/channel/v1/tx'
import {
  MsgExec,
  MsgGrant,
  MsgRevoke,
} from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx'
import {
  MsgDeposit,
  MsgSubmitProposal,
  MsgVote,
  MsgVoteWeighted,
} from 'cosmjs-types/cosmos/gov/v1/tx'
import { MsgUnjail } from 'cosmjs-types/cosmos/slashing/v1beta1/tx'
import {
  MsgGrantAllowance,
  MsgRevokeAllowance,
} from 'cosmjs-types/cosmos/feegrant/v1beta1/tx'
import {
  AllowedMsgAllowance,
  BasicAllowance,
  PeriodicAllowance,
} from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant'
import type { Any } from 'cosmjs-types/google/protobuf/any'
import type { Timestamp } from 'cosmjs-types/google/protobuf/timestamp'
import type { Duration } from 'cosmjs-types/google/protobuf/duration'
import { BinaryReader } from 'cosmjs-types/binary'
import { Keccak256 } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'
import { decodeLegacyDecString } from '../utils/cosmos'

const TYPE = {
  MsgSend: '/cosmos.bank.v1beta1.MsgSend',
  MsgWithdrawDelegatorReward:
    '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  MsgWithdrawValidatorCommission:
    '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
  MsgSetWithdrawAddress: '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress',
  MsgFundCommunityPool: '/cosmos.distribution.v1beta1.MsgFundCommunityPool',
  MsgCommunityPoolSpend: '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend',
  MsgDelegate: '/cosmos.staking.v1beta1.MsgDelegate',
  MsgUndelegate: '/cosmos.staking.v1beta1.MsgUndelegate',
  MsgBeginRedelegate: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  MsgCancelUnbondingDelegation:
    '/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation',
  MsgCreateValidator: '/cosmos.staking.v1beta1.MsgCreateValidator',
  MsgEditValidator: '/cosmos.staking.v1beta1.MsgEditValidator',
  MsgUnjail: '/cosmos.slashing.v1beta1.MsgUnjail',
  MsgSubmitProposal: '/cosmos.gov.v1.MsgSubmitProposal',
  MsgVote: '/cosmos.gov.v1.MsgVote',
  MsgVoteWeighted: '/cosmos.gov.v1.MsgVoteWeighted',
  MsgDeposit: '/cosmos.gov.v1.MsgDeposit',
  MsgCreateClient: '/ibc.core.client.v1.MsgCreateClient',
  MsgUpdateClient: '/ibc.core.client.v1.MsgUpdateClient',
  MsgConnectionOpenInit: '/ibc.core.connection.v1.MsgConnectionOpenInit',
  MsgConnectionOpenTry: '/ibc.core.connection.v1.MsgConnectionOpenTry',
  MsgConnectionOpenAck: '/ibc.core.connection.v1.MsgConnectionOpenAck',
  MsgConnectionOpenConfirm: '/ibc.core.connection.v1.MsgConnectionOpenConfirm',
  MsgChannelOpenInit: '/ibc.core.channel.v1.MsgChannelOpenInit',
  MsgChannelOpenTry: '/ibc.core.channel.v1.MsgChannelOpenTry',
  MsgChannelOpenAck: '/ibc.core.channel.v1.MsgChannelOpenAck',
  MsgChannelOpenConfirm: '/ibc.core.channel.v1.MsgChannelOpenConfirm',
  MsgChannelCloseInit: '/ibc.core.channel.v1.MsgChannelCloseInit',
  MsgChannelCloseConfirm: '/ibc.core.channel.v1.MsgChannelCloseConfirm',
  MsgAcknowledgement: '/ibc.core.channel.v1.MsgAcknowledgement',
  MsgRecvPacket: '/ibc.core.channel.v1.MsgRecvPacket',
  MsgTimeout: '/ibc.core.channel.v1.MsgTimeout',
  MsgTimeoutOnClose: '/ibc.core.channel.v1.MsgTimeoutOnClose',
  MsgExec: '/cosmos.authz.v1beta1.MsgExec',
  MsgGrant: '/cosmos.authz.v1beta1.MsgGrant',
  MsgRevoke: '/cosmos.authz.v1beta1.MsgRevoke',
  MsgTransfer: '/ibc.applications.transfer.v1.MsgTransfer',
  MsgSoftwareUpgrade: '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade',
  MsgGrantAllowance: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
  MsgRevokeAllowance: '/cosmos.feegrant.v1beta1.MsgRevokeAllowance',
  MsgEthereumTx: '/cosmos.evm.vm.v1.MsgEthereumTx',
  MsgAttestDeposit: '/steemvm.steembridge.v1.MsgAttestDeposit',
  MsgBridgeOut: '/steemvm.steembridge.v1.MsgBridgeOut',
  MsgSubmitNameRegistration: '/steemvm.steembridge.v1.MsgSubmitNameRegistration',
  MsgConfirmName: '/steemvm.steembridge.v1.MsgConfirmName',
  MsgAttestWithdrawalPayout:
    '/steemvm.steembridge.v1.MsgAttestWithdrawalPayout',
  MsgAggregateExchangeRateVote:
    '/steemvm.oracle.data.v1.MsgAggregateExchangeRateVote',
  MsgAggregateExchangeRatePrevote:
    '/steemvm.oracle.data.v1.MsgAggregateExchangeRatePrevote',
  MsgUpdateFeemarketParams: '/cosmos.evm.feemarket.v1.MsgUpdateParams',
}

export interface DecodeMsg {
  typeUrl: string
  data: object | null
}

// MsgEthereumTx (cosmos.evm.vm.v1) wraps a raw signed Ethereum transaction.
// cosmjs-types has no generated types for this module, so this is a minimal
// hand decoder — verified field-by-field against live chain data rather than
// assumed from a spec, since the field layout doesn't match older
// Ethermint/Evmos-style MsgEthereumTx messages:
//   field 5 (bytes): the `from` address, raw 20 bytes
//   field 6 (bytes): the fully signed typed Ethereum transaction (RLP)
// We don't decode the RLP payload itself (that needs full EVM tx-type
// knowledge) — we only need the tx hash to look it up via the chain's own
// EVM JSON-RPC, and Ethereum defines that hash as keccak256 of exactly these
// raw signed bytes, so no RLP parsing is required to get it.
interface MsgEthereumTxFields {
  hash: string
  from: string
}

const decodeMsgEthereumTx = (value: Uint8Array): MsgEthereumTxFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  let fromBytes: Uint8Array | null = null
  let rawTxBytes: Uint8Array | null = null

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    if (wireType === 2) {
      const bytes = reader.bytes()
      if (fieldNo === 5) fromBytes = bytes
      if (fieldNo === 6) rawTxBytes = bytes
    } else {
      reader.skipType(wireType)
    }
  }

  return {
    from: fromBytes ? `0x${toHex(fromBytes)}` : '',
    hash: rawTxBytes ? `0x${toHex(new Keccak256(rawTxBytes).digest())}` : '',
  }
}

// MsgAttestDeposit (steemvm.steembridge.v1) — an oracle validator attesting
// to a Steem-side deposit. Named MsgSubmitSteemDeposit here until the actual
// on-chain type name (`MsgAttestDeposit`, confirmed both against a live tx's
// typeUrl and the chain repo's own module docs) was verified — same field
// layout as guessed, just the wrong type name, which meant every tx of this
// type silently fell through to decodeUnknownMessage's field_N fallback
// instead of this decoder. No proto is available for this custom module, so
// the field numbers/wire types below were verified by hand (walking the raw
// protobuf bytes of a real tx) rather than assumed:
//   1 validator (string, bech32 account address of the oracle)
//   2 txid (string, Steem txid)
//   3 op_index (varint uint32 — proto3 omits this on the wire when 0)
//   4 steem_block (varint uint64)
//   5 steem_timestamp (string)
//   6 steem_sender (string)
//   7 gateway_account (string)
//   8 amount_millisteem (varint uint64)
//   9 memo (string)
interface MsgAttestDepositFields {
  validator: string
  txid: string
  opIndex: number
  steemBlock: string
  steemTimestamp: string
  steemSender: string
  gatewayAccount: string
  amountMillisteem: string
  memo: string
}

const decodeMsgAttestDeposit = (
  value: Uint8Array
): MsgAttestDepositFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgAttestDepositFields> = { opIndex: 0 }

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.validator = reader.string()
        break
      case 2:
        fields.txid = reader.string()
        break
      case 3:
        fields.opIndex = reader.uint32()
        break
      case 4:
        fields.steemBlock = reader.uint64().toString()
        break
      case 5:
        fields.steemTimestamp = reader.string()
        break
      case 6:
        fields.steemSender = reader.string()
        break
      case 7:
        fields.gatewayAccount = reader.string()
        break
      case 8:
        fields.amountMillisteem = reader.uint64().toString()
        break
      case 9:
        fields.memo = reader.string()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    validator: fields.validator ?? '',
    txid: fields.txid ?? '',
    opIndex: fields.opIndex ?? 0,
    steemBlock: fields.steemBlock ?? '0',
    steemTimestamp: fields.steemTimestamp ?? '',
    steemSender: fields.steemSender ?? '',
    gatewayAccount: fields.gatewayAccount ?? '',
    amountMillisteem: fields.amountMillisteem ?? '0',
    memo: fields.memo ?? '',
  }
}

// MsgBridgeOut (steemvm.steembridge.v1) — a user burning asteem to withdraw
// back to Steem ("bridge-out"). No proto available; field numbers verified
// by hand-walking the raw protobuf bytes of a real tx, same method as
// MsgAttestDeposit. All fields are plain strings:
//   1 sender, 2 destination_steem_account, 3 amount_asteem, 4 memo
interface MsgBridgeOutFields {
  sender: string
  destinationSteemAccount: string
  amountAsteem: string
  memo: string
}

const decodeMsgBridgeOut = (value: Uint8Array): MsgBridgeOutFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgBridgeOutFields> = {}

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.sender = reader.string()
        break
      case 2:
        fields.destinationSteemAccount = reader.string()
        break
      case 3:
        fields.amountAsteem = reader.string()
        break
      case 4:
        fields.memo = reader.string()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    sender: fields.sender ?? '',
    destinationSteemAccount: fields.destinationSteemAccount ?? '',
    amountAsteem: fields.amountAsteem ?? '0',
    memo: fields.memo ?? '',
  }
}

// MsgSubmitNameRegistration (steemvm.steembridge.v1) — an oracle validator
// attesting to a Steem-name registration request. Identical field layout to
// MsgAttestDeposit (verified by hand-walking a real tx's protobuf
// bytes), just field 6 is the Steem account being registered rather than a
// deposit sender:
//   1 validator, 2 txid, 3 op_index, 4 steem_block, 5 steem_timestamp,
//   6 steem_account, 7 gateway_account, 8 amount_millisteem, 9 memo
interface MsgSubmitNameRegistrationFields {
  validator: string
  txid: string
  opIndex: number
  steemBlock: string
  steemTimestamp: string
  steemAccount: string
  gatewayAccount: string
  amountMillisteem: string
  memo: string
}

const decodeMsgSubmitNameRegistration = (
  value: Uint8Array
): MsgSubmitNameRegistrationFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgSubmitNameRegistrationFields> = { opIndex: 0 }

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.validator = reader.string()
        break
      case 2:
        fields.txid = reader.string()
        break
      case 3:
        fields.opIndex = reader.uint32()
        break
      case 4:
        fields.steemBlock = reader.uint64().toString()
        break
      case 5:
        fields.steemTimestamp = reader.string()
        break
      case 6:
        fields.steemAccount = reader.string()
        break
      case 7:
        fields.gatewayAccount = reader.string()
        break
      case 8:
        fields.amountMillisteem = reader.uint64().toString()
        break
      case 9:
        fields.memo = reader.string()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    validator: fields.validator ?? '',
    txid: fields.txid ?? '',
    opIndex: fields.opIndex ?? 0,
    steemBlock: fields.steemBlock ?? '0',
    steemTimestamp: fields.steemTimestamp ?? '',
    steemAccount: fields.steemAccount ?? '',
    gatewayAccount: fields.gatewayAccount ?? '',
    amountMillisteem: fields.amountMillisteem ?? '0',
    memo: fields.memo ?? '',
  }
}

// MsgConfirmName (steemvm.steembridge.v1) — the destination address
// confirming an awaiting name registration, the SVMNS lifecycle's final
// step. Simplest steembridge message decoded so far: just two fields,
// verified by hand-walking a real tx's protobuf bytes.
//   1 confirmer (string, bech32 account), 2 registration_id (varint uint64)
interface MsgConfirmNameFields {
  confirmer: string
  registrationId: string
}

const decodeMsgConfirmName = (value: Uint8Array): MsgConfirmNameFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgConfirmNameFields> = {}

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.confirmer = reader.string()
        break
      case 2:
        fields.registrationId = reader.uint64().toString()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    confirmer: fields.confirmer ?? '',
    registrationId: fields.registrationId ?? '0',
  }
}

// MsgAttestWithdrawalPayout (steemvm.steembridge.v1) — an oracle validator
// attesting that a withdrawal's Steem-side payout has landed. No proto
// available; field numbers verified by hand-walking the raw protobuf bytes
// of two real txs (one for withdrawal id 0, one for id 1) — comparing them
// is what confirmed field 2 is withdrawalId (proto3 omits it on the wire for
// id 0, exactly like op_index elsewhere in this file). Field 4 never
// appeared non-empty in either sample, so its purpose is unknown and it's
// left undecoded (falls through to skipType, same as any other unhandled
// field number):
//   1 validator (string, bech32 account address of the oracle)
//   2 withdrawal_id (varint uint64 — omitted on the wire when 0)
//   3 steem_txid (string, the Steem-side payout txid)
//   5 steem_block (varint uint64)
//   6 steem_timestamp (string)
interface MsgAttestWithdrawalPayoutFields {
  validator: string
  withdrawalId: string
  steemTxid: string
  steemBlock: string
  steemTimestamp: string
}

const decodeMsgAttestWithdrawalPayout = (
  value: Uint8Array
): MsgAttestWithdrawalPayoutFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgAttestWithdrawalPayoutFields> = { withdrawalId: '0' }

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.validator = reader.string()
        break
      case 2:
        fields.withdrawalId = reader.uint64().toString()
        break
      case 3:
        fields.steemTxid = reader.string()
        break
      case 5:
        fields.steemBlock = reader.uint64().toString()
        break
      case 6:
        fields.steemTimestamp = reader.string()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    validator: fields.validator ?? '',
    withdrawalId: fields.withdrawalId ?? '0',
    steemTxid: fields.steemTxid ?? '',
    steemBlock: fields.steemBlock ?? '0',
    steemTimestamp: fields.steemTimestamp ?? '',
  }
}

// MsgAggregateExchangeRateVote / MsgAggregateExchangeRatePrevote
// (steemvm.oracle.data.v1) — the reveal and commit halves of the oracledata
// module's commit-reveal price-feed voting (see chain/oracleLcd.ts). No
// proto available; field numbers verified by hand-walking the raw protobuf
// bytes of two real txs. Field *names* below match the module's own emitted
// event attribute names (`aggregate_vote`'s `validator`/`exchange_rate`,
// `aggregate_prevote`'s `validator`/`hash`) rather than a guessed proto
// field name, since those event names come straight from the chain binary
// and are the one thing here that isn't a guess:
//   Vote:    1 validator (string, bech32 account — same "account form for an
//            oracle identity" pattern as MsgAttestDeposit's field 1)
//            2 salt (string, hex — the commit-reveal salt)
//            3 exchange_rates (string, comma-separated "PAIR:rate" list —
//            parsed into structured entries below rather than left as one
//            long string, since the format is simple and verified)
//   Prevote: 1 validator (string, bech32 account)
//            2 hash (string, hex — commit hash of salt+exchange_rates+validator)
export interface ExchangeRateVoteEntry {
  pair: string
  rate: string
}

const parseExchangeRatesCsv = (raw: string): ExchangeRateVoteEntry[] =>
  raw
    .split(',')
    .map((entry): ExchangeRateVoteEntry | null => {
      const [pair, rate] = entry.split(':')
      return pair && rate ? { pair, rate } : null
    })
    .filter((entry): entry is ExchangeRateVoteEntry => entry !== null)

interface MsgAggregateExchangeRateVoteFields {
  validator: string
  salt: string
  exchangeRates: ExchangeRateVoteEntry[]
}

const decodeMsgAggregateExchangeRateVote = (
  value: Uint8Array
): MsgAggregateExchangeRateVoteFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: { validator?: string; salt?: string; exchangeRatesRaw?: string } =
    {}

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.validator = reader.string()
        break
      case 2:
        fields.salt = reader.string()
        break
      case 3:
        fields.exchangeRatesRaw = reader.string()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    validator: fields.validator ?? '',
    salt: fields.salt ?? '',
    exchangeRates: parseExchangeRatesCsv(fields.exchangeRatesRaw ?? ''),
  }
}

interface MsgAggregateExchangeRatePrevoteFields {
  validator: string
  hash: string
}

const decodeMsgAggregateExchangeRatePrevote = (
  value: Uint8Array
): MsgAggregateExchangeRatePrevoteFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgAggregateExchangeRatePrevoteFields> = {}

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.validator = reader.string()
        break
      case 2:
        fields.hash = reader.string()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    validator: fields.validator ?? '',
    hash: fields.hash ?? '',
  }
}

// MsgUpdateParams (cosmos.evm.feemarket.v1) — a gov-only parameter-change
// message for the EVM feemarket module (controls EIP-1559 base fee behavior
// and the chain's minimum gas price). cosmjs-types has no generated types
// for this module (same situation as MsgEthereumTx), so both the outer
// message and its nested Params sub-message are hand-decoded here. Field
// numbers/types verified two ways: against the real proto
// (github.com/cosmos/evm, proto/cosmos/evm/feemarket/v1/{tx,feemarket}.proto)
// and by cross-checking the decoded values byte-for-byte against a real
// proposal's LCD JSON (GET /cosmos/gov/v1/proposals/{id}) — they matched
// exactly, including the non-obvious part: min_gas_price is field 7, not 6
// (field 4, initial_base_fee, is reserved/deprecated on the wire, which is
// why the numbering skips it).
//   MsgUpdateParams: 1 authority (string), 2 params (embedded Params message)
//   Params: 1 no_base_fee (bool), 2 base_fee_change_denominator (uint32),
//     3 elasticity_multiplier (uint32), 5 enable_height (int64),
//     6 base_fee (LegacyDec), 7 min_gas_price (LegacyDec),
//     8 min_gas_multiplier (LegacyDec)
interface FeemarketParamsFields {
  noBaseFee: boolean
  baseFeeChangeDenominator: number
  elasticityMultiplier: number
  enableHeight: string
  baseFee: string
  minGasPrice: string
  minGasMultiplier: string
}

const decodeFeemarketParams = (value: Uint8Array): FeemarketParamsFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<FeemarketParamsFields> = {}

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.noBaseFee = reader.bool()
        break
      case 2:
        fields.baseFeeChangeDenominator = reader.uint32()
        break
      case 3:
        fields.elasticityMultiplier = reader.uint32()
        break
      case 5:
        fields.enableHeight = reader.int64().toString()
        break
      case 6:
        fields.baseFee = decodeLegacyDecString(reader.string())
        break
      case 7:
        fields.minGasPrice = decodeLegacyDecString(reader.string())
        break
      case 8:
        fields.minGasMultiplier = decodeLegacyDecString(reader.string())
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    noBaseFee: fields.noBaseFee ?? false,
    baseFeeChangeDenominator: fields.baseFeeChangeDenominator ?? 0,
    elasticityMultiplier: fields.elasticityMultiplier ?? 0,
    enableHeight: fields.enableHeight ?? '0',
    baseFee: fields.baseFee ?? '0.000000000000000000',
    minGasPrice: fields.minGasPrice ?? '0.000000000000000000',
    minGasMultiplier: fields.minGasMultiplier ?? '0.000000000000000000',
  }
}

interface MsgUpdateFeemarketParamsFields {
  authority: string
  params: FeemarketParamsFields
}

const decodeMsgUpdateFeemarketParams = (
  value: Uint8Array
): MsgUpdateFeemarketParamsFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgUpdateFeemarketParamsFields> = {}

  while (reader.pos < end) {
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    switch (fieldNo) {
      case 1:
        fields.authority = reader.string()
        break
      case 2:
        fields.params = decodeFeemarketParams(reader.bytes())
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return {
    authority: fields.authority ?? '',
    params: fields.params ?? {
      noBaseFee: false,
      baseFeeChangeDenominator: 0,
      elasticityMultiplier: 0,
      enableHeight: '0',
      baseFee: '0.000000000000000000',
      minGasPrice: '0.000000000000000000',
      minGasMultiplier: '0.000000000000000000',
    },
  }
}

// MsgGrantAllowance (cosmos.feegrant.v1beta1) — cosmjs-types has generated
// types for the outer message, but its `allowance` field is a polymorphic
// `google.protobuf.Any` (one of BasicAllowance/PeriodicAllowance/
// AllowedMsgAllowance) that the generated decoder leaves as raw
// {typeUrl, value: Uint8Array} — left undecoded, that's exactly the kind of
// opaque bytes this file's decoders exist to avoid. Decode the Any's inner
// bytes against whichever concrete allowance type its typeUrl names
// (verified live: tx 8DEB941F...B034DC carries a BasicAllowance with an
// empty spend_limit and no expiration, i.e. an unlimited allowance).
// AllowedMsgAllowance nests another Any allowance inside it, so this
// recurses one level for that case.
const timestampToIso = (ts?: Timestamp): string | null => {
  if (!ts) return null
  const millis = Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6)
  return new Date(millis).toISOString()
}

const durationToString = (d?: Duration): string | null =>
  d ? `${d.seconds.toString()}s` : null

interface DecodedFeeAllowance {
  typeUrl: string
  spendLimit?: { denom: string; amount: string }[]
  expiration?: string | null
  periodSeconds?: string | null
  periodSpendLimit?: { denom: string; amount: string }[]
  periodCanSpend?: { denom: string; amount: string }[]
  periodReset?: string | null
  allowedMessages?: string[]
  nestedAllowance?: DecodedFeeAllowance | null
}

const decodeFeeAllowance = (allowance?: Any): DecodedFeeAllowance | null => {
  if (!allowance) return null
  switch (allowance.typeUrl) {
    case '/cosmos.feegrant.v1beta1.BasicAllowance': {
      const basic = BasicAllowance.decode(allowance.value)
      return {
        typeUrl: allowance.typeUrl,
        spendLimit: basic.spendLimit,
        expiration: timestampToIso(basic.expiration),
      }
    }
    case '/cosmos.feegrant.v1beta1.PeriodicAllowance': {
      const periodic = PeriodicAllowance.decode(allowance.value)
      return {
        typeUrl: allowance.typeUrl,
        spendLimit: periodic.basic?.spendLimit ?? [],
        expiration: timestampToIso(periodic.basic?.expiration),
        periodSeconds: durationToString(periodic.period),
        periodSpendLimit: periodic.periodSpendLimit,
        periodCanSpend: periodic.periodCanSpend,
        periodReset: timestampToIso(periodic.periodReset),
      }
    }
    case '/cosmos.feegrant.v1beta1.AllowedMsgAllowance': {
      const allowed = AllowedMsgAllowance.decode(allowance.value)
      return {
        typeUrl: allowance.typeUrl,
        allowedMessages: allowed.allowedMessages,
        nestedAllowance: decodeFeeAllowance(allowed.allowance),
      }
    }
    default:
      return { typeUrl: allowance.typeUrl }
  }
}

interface MsgGrantAllowanceFields {
  granter: string
  grantee: string
  allowance: DecodedFeeAllowance | null
}

const decodeMsgGrantAllowance = (
  value: Uint8Array
): MsgGrantAllowanceFields => {
  const msg = MsgGrantAllowance.decode(value)
  return {
    granter: msg.granter,
    grantee: msg.grantee,
    allowance: decodeFeeAllowance(msg.allowance),
  }
}

// Best-effort decoder for message types we have no generated (or hand-
// written) decoder for — e.g. a chain-specific custom module where no proto
// is available to decode against. Surfaces the raw protobuf fields (numbered, since we don't
// know their real names) instead of showing nothing: printable text is
// shown as a string, 20/32-byte values (the common length for
// addresses/hashes) as 0x-hex, everything else as 0x-hex with a byte count.
// This is honest about what it doesn't know rather than guessing field
// names — if you have the real .proto for a type, add a proper decoder
// above instead.
const decodeIfPrintableText = (bytes: Uint8Array): string | null => {
  if (bytes.length === 0) return null

  let text = ''
  for (const byte of bytes) {
    const isPrintableAscii = byte >= 0x20 && byte <= 0x7e
    const isCommonWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d
    if (!isPrintableAscii && !isCommonWhitespace) return null
    text += String.fromCharCode(byte)
  }
  return text
}

const decodeUnknownMessage = (value: Uint8Array): Record<string, unknown> => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Record<string, unknown> = {}
  let fieldCount = 0

  while (reader.pos < end && fieldCount < 200) {
    fieldCount += 1
    const tag = reader.uint32()
    const fieldNo = tag >>> 3
    const wireType = tag & 7
    const key = `field_${fieldNo}`

    switch (wireType) {
      case 0:
        fields[key] = reader.uint64().toString()
        break
      case 1:
        fields[key] = reader.double()
        break
      case 2: {
        const bytes = reader.bytes()
        const text = decodeIfPrintableText(bytes)
        if (text !== null) {
          fields[key] = text
        } else if (bytes.length === 20 || bytes.length === 32) {
          fields[key] = `0x${toHex(bytes)}`
        } else {
          fields[key] = `0x${toHex(bytes)} (${bytes.length} bytes)`
        }
        break
      }
      case 5:
        fields[key] = reader.fixed32()
        break
      default:
        reader.skipType(wireType)
        break
    }
  }

  return fields
}

export const decodeMsg = (typeUrl: string, value: Uint8Array): DecodeMsg => {
  let data = null
  switch (typeUrl) {
    case TYPE.MsgSend:
      data = MsgSend.decode(value)
      break
    case TYPE.MsgWithdrawDelegatorReward:
      data = MsgWithdrawDelegatorReward.decode(value)
      break
    case TYPE.MsgWithdrawValidatorCommission:
      data = MsgWithdrawValidatorCommission.decode(value)
      break
    case TYPE.MsgSetWithdrawAddress:
      data = MsgSetWithdrawAddress.decode(value)
      break
    case TYPE.MsgFundCommunityPool:
      data = MsgFundCommunityPool.decode(value)
      break
    case TYPE.MsgCommunityPoolSpend:
      data = MsgCommunityPoolSpend.decode(value)
      break
    case TYPE.MsgDelegate:
      data = MsgDelegate.decode(value)
      break
    case TYPE.MsgUndelegate:
      data = MsgUndelegate.decode(value)
      break
    case TYPE.MsgBeginRedelegate:
      data = MsgBeginRedelegate.decode(value)
      break
    case TYPE.MsgCancelUnbondingDelegation:
      data = MsgCancelUnbondingDelegation.decode(value)
      break
    case TYPE.MsgCreateValidator:
      data = MsgCreateValidator.decode(value)
      break
    case TYPE.MsgEditValidator:
      data = MsgEditValidator.decode(value)
      break
    case TYPE.MsgUnjail:
      data = MsgUnjail.decode(value)
      break
    case TYPE.MsgSubmitProposal:
      data = MsgSubmitProposal.decode(value)
      break
    case TYPE.MsgVote:
      data = MsgVote.decode(value)
      break
    case TYPE.MsgVoteWeighted:
      data = MsgVoteWeighted.decode(value)
      break
    case TYPE.MsgDeposit:
      data = MsgDeposit.decode(value)
      break
    case TYPE.MsgCreateClient:
      data = MsgCreateClient.decode(value)
      break
    case TYPE.MsgUpdateClient:
      data = MsgUpdateClient.decode(value)
      break
    case TYPE.MsgConnectionOpenInit:
      data = MsgConnectionOpenInit.decode(value)
      break
    case TYPE.MsgConnectionOpenTry:
      data = MsgConnectionOpenTry.decode(value)
      break
    case TYPE.MsgConnectionOpenAck:
      data = MsgConnectionOpenAck.decode(value)
      break
    case TYPE.MsgConnectionOpenConfirm:
      data = MsgConnectionOpenConfirm.decode(value)
      break
    case TYPE.MsgChannelOpenInit:
      data = MsgChannelOpenInit.decode(value)
      break
    case TYPE.MsgChannelOpenTry:
      data = MsgChannelOpenTry.decode(value)
      break
    case TYPE.MsgChannelOpenAck:
      data = MsgChannelOpenAck.decode(value)
      break
    case TYPE.MsgChannelOpenConfirm:
      data = MsgChannelOpenConfirm.decode(value)
      break
    case TYPE.MsgChannelCloseInit:
      data = MsgChannelCloseInit.decode(value)
      break
    case TYPE.MsgChannelCloseConfirm:
      data = MsgChannelCloseConfirm.decode(value)
      break
    case TYPE.MsgAcknowledgement:
      data = MsgAcknowledgement.decode(value)
      break
    case TYPE.MsgRecvPacket:
      data = MsgRecvPacket.decode(value)
      break
    case TYPE.MsgTimeout:
      data = MsgTimeout.decode(value)
      break
    case TYPE.MsgTimeoutOnClose:
      data = MsgTimeoutOnClose.decode(value)
      break
    case TYPE.MsgExec:
      data = MsgExec.decode(value)
      break
    case TYPE.MsgGrant:
      data = MsgGrant.decode(value)
      break
    case TYPE.MsgRevoke:
      data = MsgRevoke.decode(value)
      break
    case TYPE.MsgTransfer:
      data = MsgTransfer.decode(value)
      break
    case TYPE.MsgSoftwareUpgrade:
      data = MsgSoftwareUpgrade.decode(value)
      break
    case TYPE.MsgGrantAllowance:
      data = decodeMsgGrantAllowance(value)
      break
    case TYPE.MsgRevokeAllowance:
      data = MsgRevokeAllowance.decode(value)
      break
    case TYPE.MsgEthereumTx:
      data = decodeMsgEthereumTx(value)
      break
    case TYPE.MsgAttestDeposit:
      data = decodeMsgAttestDeposit(value)
      break
    case TYPE.MsgBridgeOut:
      data = decodeMsgBridgeOut(value)
      break
    case TYPE.MsgSubmitNameRegistration:
      data = decodeMsgSubmitNameRegistration(value)
      break
    case TYPE.MsgConfirmName:
      data = decodeMsgConfirmName(value)
      break
    case TYPE.MsgAttestWithdrawalPayout:
      data = decodeMsgAttestWithdrawalPayout(value)
      break
    case TYPE.MsgAggregateExchangeRateVote:
      data = decodeMsgAggregateExchangeRateVote(value)
      break
    case TYPE.MsgAggregateExchangeRatePrevote:
      data = decodeMsgAggregateExchangeRatePrevote(value)
      break
    case TYPE.MsgUpdateFeemarketParams:
      data = decodeMsgUpdateFeemarketParams(value)
      break
    default:
      data = decodeUnknownMessage(value)
      break
  }

  return {
    typeUrl,
    data,
  }
}
