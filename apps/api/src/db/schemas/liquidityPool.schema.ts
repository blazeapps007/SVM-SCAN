import { z } from 'zod'

export const LIQUIDITY_POOLS_COLLECTION = 'liquidityPools'

const tokenMetaSchema = z.object({
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  decimals: z.string().nullable(),
})

export const liquidityPoolSchema = z.object({
  poolAddress: z.string(),
  factoryAddress: z.string(),
  token0Address: z.string(),
  token1Address: z.string(),
  token0: tokenMetaSchema,
  token1: tokenMetaSchema,
  fee: z.string(),
  tickSpacing: z.string(),
  createdAtHeight: z.number().int().nonnegative(),
  createdAtTxHash: z.string(),
  createdAt: z.date(),
})

export type LiquidityPoolDoc = z.infer<typeof liquidityPoolSchema>
