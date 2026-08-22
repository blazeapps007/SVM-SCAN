import { z } from 'zod'

export const REWARD_CLAIMS_COLLECTION = 'rewardClaims'

const coinSchema = z.object({
  denom: z.string(),
  amount: z.string(),
})

export const rewardClaimSchema = z.object({
  // `${txHash}-${eventIndex}` — stable across re-indexing (backfill/live-tail
  // both produce the same id for the same event), used as the upsert key.
  id: z.string(),
  txHash: z.string(),
  height: z.number().int().nonnegative(),
  timestamp: z.date(),
  claimType: z.enum(['delegator_reward', 'validator_commission']),
  validatorAddress: z.string(),
  claimantAddress: z.string(),
  amount: z.array(coinSchema),
})

export type RewardClaimDoc = z.infer<typeof rewardClaimSchema>
