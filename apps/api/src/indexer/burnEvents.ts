import type { TxEventDoc } from '@dexplorer/shared'

export interface BurnedCoin {
  denom: string
  amount: string
}

// A Cosmos SDK Coins.String() value, e.g. "1500000000000000000asteem" or
// (rare, multi-denom) "1000uatom,500asteem" — same shape as
// indexer/rewardClaims.ts's parseCoinsString, duplicated locally since each
// caller only needs this one small regex, not a shared utility.
function parseCoinsString(value: string): BurnedCoin[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.match(/^(\d+)([a-zA-Z][a-zA-Z0-9/-]*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ amount: match[1], denom: match[2] }))
}

// x/oracle/bridge's STEEMBLACKHOLE module account is this chain's SOLE burn
// point (verified against the chain's own source, keeper/blackhole.go's
// SweepBlackHole doc comment): bridge-out net amounts, the 25% tx-fee-split
// burn (keeper/feesplit.go's SplitFees, which runs every BeginBlock), and
// anything else sent to the black-hole address are all destroyed together
// via one bankKeeper.BurnCoins call in that module's EndBlock. That call
// emits the standard Cosmos SDK bank module's "burn" event — so summing
// every "burn" event in a block's endBlockEvents gives the exact total
// destroyed that block, regardless of which of those sources it came from,
// with no need to separately track (or double-count) bridge withdrawals.
export function extractBurnedCoins(
  endBlockEvents: readonly TxEventDoc[]
): BurnedCoin[] {
  const totals = new Map<string, bigint>()

  for (const event of endBlockEvents) {
    if (event.type !== 'burn') continue
    const amountAttr = event.attributes.find((a) => a.key === 'amount')
    if (!amountAttr) continue

    for (const coin of parseCoinsString(amountAttr.value)) {
      const current = totals.get(coin.denom) ?? 0n
      totals.set(coin.denom, current + BigInt(coin.amount))
    }
  }

  return Array.from(totals.entries()).map(([denom, amount]) => ({
    denom,
    amount: amount.toString(),
  }))
}
