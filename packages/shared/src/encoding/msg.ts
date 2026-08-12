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
import { BinaryReader } from 'cosmjs-types/binary'
import { Keccak256 } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'

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
  MsgEthereumTx: '/cosmos.evm.vm.v1.MsgEthereumTx',
  MsgSubmitSteemDeposit: '/steemvm.steembridge.v1.MsgSubmitSteemDeposit',
  MsgBridgeOut: '/steemvm.steembridge.v1.MsgBridgeOut',
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

// MsgSubmitSteemDeposit (steemvm.steembridge.v1) — an oracle validator
// attesting to a Steem-side deposit. No proto is available for this custom
// module, so the field numbers/wire types below were verified by hand
// (walking the raw protobuf bytes of a real tx) rather than assumed:
//   1 validator (string, bech32 account address of the oracle)
//   2 txid (string, Steem txid)
//   3 op_index (varint uint32 — proto3 omits this on the wire when 0)
//   4 steem_block (varint uint64)
//   5 steem_timestamp (string)
//   6 steem_sender (string)
//   7 gateway_account (string)
//   8 amount_millisteem (varint uint64)
//   9 memo (string)
interface MsgSubmitSteemDepositFields {
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

const decodeMsgSubmitSteemDeposit = (
  value: Uint8Array
): MsgSubmitSteemDepositFields => {
  const reader = new BinaryReader(value)
  const end = reader.len
  const fields: Partial<MsgSubmitSteemDepositFields> = { opIndex: 0 }

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
// MsgSubmitSteemDeposit. All fields are plain strings:
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

// Best-effort decoder for message types we have no generated (or hand-
// written) decoder for — e.g. a chain-specific custom module like
// steemvm.steembridge.v1.MsgConfirmName, where no proto is available to
// decode against. Surfaces the raw protobuf fields (numbered, since we don't
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
    case TYPE.MsgEthereumTx:
      data = decodeMsgEthereumTx(value)
      break
    case TYPE.MsgSubmitSteemDeposit:
      data = decodeMsgSubmitSteemDeposit(value)
      break
    case TYPE.MsgBridgeOut:
      data = decodeMsgBridgeOut(value)
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
