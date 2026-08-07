import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import {
  MsgCommunityPoolSpend,
  MsgWithdrawDelegatorReward,
} from 'cosmjs-types/cosmos/distribution/v1beta1/tx'
import { MsgDelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx'
import { MsgUpdateClient } from 'cosmjs-types/ibc/core/client/v1/tx'
import { MsgSoftwareUpgrade } from 'cosmjs-types/cosmos/upgrade/v1beta1/tx'
import {
  MsgAcknowledgement,
  MsgRecvPacket,
} from 'cosmjs-types/ibc/core/channel/v1/tx'
import {
  MsgExec,
  MsgGrant,
  MsgRevoke,
} from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx'
import { BinaryReader } from 'cosmjs-types/binary'
import { Keccak256 } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'

const TYPE = {
  MsgSend: '/cosmos.bank.v1beta1.MsgSend',
  MsgWithdrawDelegatorReward:
    '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  MsgDelegate: '/cosmos.staking.v1beta1.MsgDelegate',
  MsgUpdateClient: '/ibc.core.client.v1.MsgUpdateClient',
  MsgAcknowledgement: '/ibc.core.channel.v1.MsgAcknowledgement',
  MsgRecvPacket: '/ibc.core.channel.v1.MsgRecvPacket',
  MsgExec: '/cosmos.authz.v1beta1.MsgExec',
  MsgGrant: '/cosmos.authz.v1beta1.MsgGrant',
  MsgRevoke: '/cosmos.authz.v1beta1.MsgRevoke',
  MsgTransfer: '/ibc.applications.transfer.v1.MsgTransfer',
  MsgCommunityPoolSpend: '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend',
  MsgSoftwareUpgrade: '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade',
  MsgEthereumTx: '/cosmos.evm.vm.v1.MsgEthereumTx',
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

export const decodeMsg = (typeUrl: string, value: Uint8Array): DecodeMsg => {
  let data = null
  switch (typeUrl) {
    case TYPE.MsgSend:
      data = MsgSend.decode(value)
      break
    case TYPE.MsgWithdrawDelegatorReward:
      data = MsgWithdrawDelegatorReward.decode(value)
      break
    case TYPE.MsgDelegate:
      data = MsgDelegate.decode(value)
      break
    case TYPE.MsgUpdateClient:
      data = MsgUpdateClient.decode(value)
      break
    case TYPE.MsgAcknowledgement:
      data = MsgAcknowledgement.decode(value)
      break
    case TYPE.MsgRecvPacket:
      data = MsgRecvPacket.decode(value)
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
    case TYPE.MsgCommunityPoolSpend:
      data = MsgCommunityPoolSpend.decode(value)
      break
    case TYPE.MsgSoftwareUpgrade:
      data = MsgSoftwareUpgrade.decode(value)
      break
    case TYPE.MsgEthereumTx:
      data = decodeMsgEthereumTx(value)
      break
    default:
      break
  }

  return {
    typeUrl,
    data,
  }
}
