import { sha256 } from '@cosmjs/crypto'
import { fromBech32, toHex, toUtf8 } from '@cosmjs/encoding'
import type { TxEventDoc } from '@dexplorer/shared'
import { parseCoinsString, type BurnedCoin } from './burnEvents'

const attribute = (event: TxEventDoc, key: string): string | undefined =>
  event.attributes.find((a) => a.key === key)?.value

const sumCoins = (coins: BurnedCoin[]): BurnedCoin[] => {
  const totals = new Map<string, bigint>()
  for (const { denom, amount } of coins) {
    totals.set(denom, (totals.get(denom) ?? 0n) + BigInt(amount))
  }
  return Array.from(totals, ([denom, amount]) => ({
    denom,
    amount: amount.toString(),
  }))
}

// The fee the chain actually deducted, from the `tx` event's `fee` attribute.
// Not auth_info.fee: the bridge's fee-exemption ante decorator waives the fee
// on messages like MsgConfirmName, so a tx can declare a fee it never pays.
export function extractPaidFee(events: readonly TxEventDoc[]): BurnedCoin[] {
  return sumCoins(
    events
      .filter((event) => event.type === 'tx')
      .flatMap((event) => parseCoinsString(attribute(event, 'fee') ?? ''))
  )
}

// Module addresses are the first 20 bytes of sha256(name), so this needs no
// LCD lookup and works whatever the bech32 prefix is.
const BRIDGE_REWARD_ADDRESS_HEX = toHex(
  sha256(toUtf8('bridge_reward')).slice(0, 20)
)

const isBridgeReward = (address: string): boolean => {
  try {
    return toHex(fromBech32(address).data) === BRIDGE_REWARD_ADDRESS_HEX
  } catch {
    return false
  }
}

// Bridge fees collected, in any direction. Deposits and withdrawals both route
// their fee to bridge_reward, and SplitFees (x/oracle/bridge/keeper/feesplit.go)
// sweeps that account into fee_collector every BeginBlock — so this one
// non-tx transfer sees every fee, however the bridge was used (message, or the
// 0x...0900 precompile), without recomputing it from the fee rate.
export function extractBridgeFees(
  blockEvents: readonly TxEventDoc[]
): BurnedCoin[] {
  return sumCoins(
    blockEvents
      .filter(
        (event) =>
          event.type === 'transfer' &&
          isBridgeReward(attribute(event, 'sender') ?? '')
      )
      .flatMap((event) => parseCoinsString(attribute(event, 'amount') ?? ''))
  )
}
