import { describe, expect, it } from 'vitest'
import { extractBridgeFees, extractPaidFee } from '../../src/indexer/feeEvents'

const event = (type: string, attrs: Record<string, string>) => ({
  type,
  attributes: Object.entries(attrs).map(([key, value]) => ({ key, value })),
})

const BRIDGE_REWARD = 'steem189zqgygvhf5j56st8698qa9nz6jjhu45d089kz'
const FEE_COLLECTOR = 'steem17xpfvakm2amg962yls6f84z3kell8c5lxvg9x8'
const DISTRIBUTION = 'steem1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8320ey9'

// Event shapes below are copied from real txs/blocks on SteemVM-Manaslu-81630.
describe('extractPaidFee', () => {
  it('reads the fee the chain actually deducted', () => {
    const events = [
      event('coin_received', { receiver: FEE_COLLECTOR, amount: '210160000000000asteem' }),
      event('tx', { fee: '210160000000000asteem', fee_payer: 'steem1p5jyg7lm0pgdy824cu4mcjd65sqj64t75tacx7' }),
      event('tx', { acc_seq: 'steem1p5jyg7lm0pgdy824cu4mcjd65sqj64t75tacx7/5' }),
    ]

    expect(extractPaidFee(events)).toEqual([
      { denom: 'asteem', amount: '210160000000000' },
    ])
  })

  it('returns nothing for a waived fee, whatever the tx declared', () => {
    const waivedConfirmName = [
      event('tx', { acc_seq: 'steem1p5jyg7lm0pgdy824cu4mcjd65sqj64t75tacx7/0' }),
      event('tx', { signature: 'k1jvJOFkxMd2xrs6QoAog0' }),
    ]

    expect(extractPaidFee(waivedConfirmName)).toEqual([])
  })

  it('treats an empty fee attribute as no fee', () => {
    expect(extractPaidFee([event('tx', { fee: '' })])).toEqual([])
  })
})

describe('extractBridgeFees', () => {
  it('reads the amount swept out of bridge_reward', () => {
    const events = [
      event('coin_spent', { spender: BRIDGE_REWARD, amount: '1035000000000000000asteem', mode: 'BeginBlock' }),
      event('transfer', { recipient: FEE_COLLECTOR, sender: BRIDGE_REWARD, amount: '1035000000000000000asteem', mode: 'BeginBlock' }),
    ]

    expect(extractBridgeFees(events)).toEqual([
      { denom: 'asteem', amount: '1035000000000000000' },
    ])
  })

  it('keeps denoms separate', () => {
    const events = [
      event('transfer', { recipient: FEE_COLLECTOR, sender: BRIDGE_REWARD, amount: '5asteem,7asbd' }),
    ]

    expect(extractBridgeFees(events)).toEqual([
      { denom: 'asteem', amount: '5' },
      { denom: 'asbd', amount: '7' },
    ])
  })

  it('ignores transfers from any other sender', () => {
    const events = [
      event('transfer', { recipient: DISTRIBUTION, sender: FEE_COLLECTOR, amount: '100asteem' }),
      event('transfer', { recipient: DISTRIBUTION, sender: 'not-bech32', amount: '100asteem' }),
    ]

    expect(extractBridgeFees(events)).toEqual([])
  })
})
