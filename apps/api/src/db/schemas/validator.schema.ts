import { z } from 'zod'

export const VALIDATORS_COLLECTION = 'validators'

const uptimeSchema = z.object({
  missedBlocksCounter: z.string(),
  signedBlocksWindow: z.string(),
})

export const validatorSchema = z.object({
  operatorAddress: z.string(),
  moniker: z.string(),
  identity: z.string(),
  website: z.string(),
  details: z.string(),
  status: z.string(),
  jailed: z.boolean(),
  tokens: z.string(),
  delegatorShares: z.string(),
  commissionRate: z.string(),
  minSelfDelegation: z.string(),
  unbondingHeight: z.string(),
  consensusPubkey: z.string().nullable(),
  // Hex consensus address derived from consensusPubkey (same encoding as a
  // block header's proposer_address) — null only if consensusPubkey itself
  // is null/unrecognized. Lets routes/blocks.ts resolve a block's raw hex
  // proposer address back to this validator without re-deriving it per call.
  consAddressHex: z.string().nullable(),
  uptime: uptimeSchema.nullable(),
  // Country of this validator's node, set by indexer/nodeLocationRefresh.ts
  // (absent until first located). Country only — the IP is never stored.
  nodeLocation: z
    .object({
      countryCode: z.string(),
      countryName: z.string(),
      seenAt: z.date(),
    })
    .nullable()
    .optional(),
  lastRefreshedAt: z.date(),
})

export type ValidatorDoc = z.infer<typeof validatorSchema>
