import { z } from 'zod'

export const CHAIN_PARAMS_COLLECTION = 'chainParams'

export type ChainParamsModule =
  | 'staking'
  | 'mint'
  | 'distribution'
  | 'slashing'
  | 'govVoting'
  | 'govDeposit'
  | 'govTally'
  | 'bridge'
  | 'oracle'

export const chainParamsSchema = z.object({
  _id: z.string(),
  params: z.unknown(),
  updatedAt: z.date(),
})

export type ChainParamsDoc = z.infer<typeof chainParamsSchema>
