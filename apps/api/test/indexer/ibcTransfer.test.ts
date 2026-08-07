import { describe, expect, it } from 'vitest'
import { extractIBCTransfer } from '../../src/indexer/ibcTransfer'

describe('extractIBCTransfer', () => {
  it('returns null when no IBC-related events are present', () => {
    const result = extractIBCTransfer([
      {
        type: 'message',
        attributes: [{ key: 'action', value: '/cosmos.bank.v1beta1.MsgSend' }],
      },
    ])
    expect(result).toBeNull()
  })

  it('extracts channel/port routing data from packet lifecycle events', () => {
    const result = extractIBCTransfer([
      {
        type: 'send_packet',
        attributes: [
          { key: 'packet_src_channel', value: 'channel-0' },
          { key: 'packet_src_port', value: 'transfer' },
          { key: 'packet_dst_channel', value: 'channel-141' },
          { key: 'packet_dst_port', value: 'transfer' },
        ],
      },
      {
        type: 'ibc_transfer',
        attributes: [
          { key: 'sender', value: 'cosmos1sender' },
          { key: 'receiver', value: 'osmo1receiver' },
          { key: 'denom', value: 'uatom' },
          { key: 'amount', value: '1000000' },
          { key: 'memo', value: '' },
        ],
      },
    ])

    expect(result).toEqual({
      sender: 'cosmos1sender',
      receiver: 'osmo1receiver',
      sourceChannel: 'channel-0',
      sourcePort: 'transfer',
      destinationChannel: 'channel-141',
      destinationPort: 'transfer',
      amount: '1000000',
      denom: 'uatom',
      memo: '',
    })
  })

  it('splits a combined Coin-style amount string when no separate denom attribute exists', () => {
    const result = extractIBCTransfer([
      {
        type: 'fungible_token_packet',
        attributes: [
          { key: 'sender', value: 'cosmos1sender' },
          { key: 'receiver', value: 'osmo1receiver' },
          { key: 'amount', value: '73325uosmo' },
        ],
      },
    ])

    expect(result?.amount).toBe('73325')
    expect(result?.denom).toBe('uosmo')
  })

  it('strips the denom trace path when a voucher is sent back to its origin chain', () => {
    const result = extractIBCTransfer([
      {
        type: 'recv_packet',
        attributes: [
          { key: 'packet_src_channel', value: 'channel-141' },
          { key: 'packet_src_port', value: 'transfer' },
          { key: 'packet_dst_channel', value: 'channel-0' },
          { key: 'packet_dst_port', value: 'transfer' },
        ],
      },
      {
        type: 'fungible_token_packet',
        attributes: [
          { key: 'sender', value: 'osmo1sender' },
          { key: 'receiver', value: 'steem1receiver' },
          { key: 'denom', value: 'transfer/channel-141/usteem' },
          { key: 'amount', value: '1000000' },
          { key: 'memo', value: '' },
        ],
      },
    ])

    expect(result?.denom).toBe('usteem')
    expect(result?.amount).toBe('1000000')
  })
})
