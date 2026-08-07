import { z } from 'zod'

export const BLOCKS_COLLECTION = 'blocks'

export const blockSchema = z.object({
  height: z.number().int().nonnegative(),
  hash: z.string(),
  time: z.date(),
  proposerAddress: z.string(),
  appHash: z.string(),
  txCount: z.number().int().nonnegative(),
  txHashes: z.array(z.string()),
})

export type BlockDoc = z.infer<typeof blockSchema>
