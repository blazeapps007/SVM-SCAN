import { z } from 'zod'

export const INDEXER_STATE_COLLECTION = 'indexerState'
export const INDEXER_STATE_ID = 'default'

export const indexerStateSchema = z.object({
  _id: z.literal(INDEXER_STATE_ID),
  chainId: z.string(),
  lastIndexedHeight: z.number().int().nonnegative(),
  lastIndexedHash: z.string(),
  mode: z.enum(['backfill', 'live']),
  updatedAt: z.date(),
})

export type IndexerStateDoc = z.infer<typeof indexerStateSchema>
