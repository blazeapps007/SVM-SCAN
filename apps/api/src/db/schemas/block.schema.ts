import { z } from 'zod'

export const BLOCKS_COLLECTION = 'blocks'

const coinSchema = z.object({
  denom: z.string(),
  amount: z.string(),
})

export const blockSchema = z.object({
  height: z.number().int().nonnegative(),
  hash: z.string(),
  time: z.date(),
  proposerAddress: z.string(),
  appHash: z.string(),
  txCount: z.number().int().nonnegative(),
  txHashes: z.array(z.string()),
  // Coins destroyed via this block's STEEMBLACKHOLE burn sweep (endBlock's
  // "burn" event) — see indexer/burnEvents.ts. Optional: blocks indexed
  // before this field existed won't have it until re-indexed.
  burned: z.array(coinSchema).optional(),
})

export type BlockDoc = z.infer<typeof blockSchema>
