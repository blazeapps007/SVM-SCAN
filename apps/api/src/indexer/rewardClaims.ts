import type { Db } from 'mongodb'
import type { DecodeMsg, TxEventDoc } from '@dexplorer/shared'
import {
  REWARD_CLAIMS_COLLECTION,
  RewardClaimDoc,
} from '../db/schemas/rewardClaim.schema'

export interface RewardClaimRecord {
  // Position of the withdraw_rewards/withdraw_commission event within the
  // tx's event list — combined with the tx hash to make each claim's doc
  // id stable/idempotent across re-indexing.
  eventIndex: number
  claimType: 'delegator_reward' | 'validator_commission'
  validatorAddress: string
  claimantAddress: string
  amount: { denom: string; amount: string }[]
}

const WITHDRAW_DELEGATOR_REWARD_TYPE =
  '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'
const WITHDRAW_VALIDATOR_COMMISSION_TYPE =
  '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission'

// A Cosmos SDK Coins.String() value, e.g. "1500000000000000000asteem" or
// (rare, multi-denom) "1000uatom,500asteem" — same shape apps/web's
// parseCoinString splits, just without that function's hex-hash guard,
// since nothing indexed here is ever a hash.
function parseCoinsString(value: string): { denom: string; amount: string }[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.match(/^(\d+)([a-zA-Z][a-zA-Z0-9/-]*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ amount: match[1], denom: match[2] }))
}

// The distribution module's withdraw_rewards/withdraw_commission events
// carry an `amount` attribute, but only withdraw_rewards also carries the
// target `validator` — withdraw_commission has neither a validator nor
// claimant attribute of its own (it's implicit: the message signer *is*
// the validator's account). So for withdraw_commission, and for the
// delegator's own address on withdraw_rewards, we correlate positionally
// against this tx's messages of the matching type — the SDK executes
// messages and emits their events in the same order, one event per
// message, so the Nth event of a type matches the Nth message of that type.
export function extractRewardClaims(
  messages: DecodeMsg[],
  events: TxEventDoc[]
): RewardClaimRecord[] {
  const delegatorRewardMessages = messages.filter(
    (m) => m.typeUrl === WITHDRAW_DELEGATOR_REWARD_TYPE
  )
  const commissionMessages = messages.filter(
    (m) => m.typeUrl === WITHDRAW_VALIDATOR_COMMISSION_TYPE
  )

  let delegatorRewardIndex = 0
  let commissionIndex = 0
  const claims: RewardClaimRecord[] = []

  events.forEach((event, eventIndex) => {
    if (event.type === 'withdraw_rewards') {
      const attrs = Object.fromEntries(
        event.attributes.map((a) => [a.key, a.value])
      )
      const amount = parseCoinsString(attrs.amount ?? '')
      const message = delegatorRewardMessages[delegatorRewardIndex]
      delegatorRewardIndex += 1
      if (!attrs.validator || amount.length === 0) return

      claims.push({
        eventIndex,
        claimType: 'delegator_reward',
        validatorAddress: attrs.validator,
        claimantAddress:
          (message?.data as { delegatorAddress?: string } | null)
            ?.delegatorAddress ?? '',
        amount,
      })
      return
    }

    if (event.type === 'withdraw_commission') {
      const attrs = Object.fromEntries(
        event.attributes.map((a) => [a.key, a.value])
      )
      const amount = parseCoinsString(attrs.amount ?? '')
      const message = commissionMessages[commissionIndex]
      commissionIndex += 1
      const validatorAddress =
        (message?.data as { validatorAddress?: string } | null)
          ?.validatorAddress ?? ''
      if (!validatorAddress || amount.length === 0) return

      claims.push({
        eventIndex,
        claimType: 'validator_commission',
        validatorAddress,
        claimantAddress: validatorAddress,
        amount,
      })
    }
  })

  return claims
}

// Called per indexed tx (backfill and live-tail both funnel through
// blockIndexer.ts), same enrichment pattern as indexLiquidityPoolsForTx —
// best-effort, a failure here must not break block indexing since this is
// on top of the core tx/block data, not load-bearing for it. Each claim's
// id is stable across re-indexing (derived from txHash + its position in
// the event list), so this is a safe upsert to re-run over already-indexed
// history.
export async function indexRewardClaimsForTx(
  db: Db,
  txHash: string,
  height: number,
  timestamp: Date,
  messages: DecodeMsg[],
  events: TxEventDoc[]
): Promise<void> {
  const claims = extractRewardClaims(messages, events)
  if (claims.length === 0) return

  try {
    const collection = db.collection<RewardClaimDoc>(REWARD_CLAIMS_COLLECTION)
    await Promise.all(
      claims.map((claim) => {
        const doc: RewardClaimDoc = {
          id: `${txHash}-${claim.eventIndex}`,
          txHash,
          height,
          timestamp,
          claimType: claim.claimType,
          validatorAddress: claim.validatorAddress,
          claimantAddress: claim.claimantAddress,
          amount: claim.amount,
        }
        return collection.updateOne(
          { id: doc.id },
          { $set: doc },
          { upsert: true }
        )
      })
    )
  } catch (err) {
    console.error(
      `Failed to index reward claims for tx ${txHash} at height ${height}:`,
      err
    )
  }
}
