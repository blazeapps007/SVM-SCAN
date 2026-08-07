import { z } from 'zod'

export const DENOM_METADATA_COLLECTION = 'denomMetadata'

export const denomMetadataSchema = z.object({
  _id: z.string(), // base denom, e.g. "uatom"
  displayName: z.string(),
  symbol: z.string(),
  decimals: z.number().int().nonnegative(),
  source: z.enum(['seed', 'manual']),
  updatedAt: z.date(),
})

export type DenomMetadataDoc = z.infer<typeof denomMetadataSchema>
