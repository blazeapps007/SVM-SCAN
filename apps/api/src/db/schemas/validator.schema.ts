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
  tokens: z.string(),
  delegatorShares: z.string(),
  commissionRate: z.string(),
  minSelfDelegation: z.string(),
  unbondingHeight: z.string(),
  consensusPubkey: z.string().nullable(),
  uptime: uptimeSchema.nullable(),
  lastRefreshedAt: z.date(),
})

export type ValidatorDoc = z.infer<typeof validatorSchema>
