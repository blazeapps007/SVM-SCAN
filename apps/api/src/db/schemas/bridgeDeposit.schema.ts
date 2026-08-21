import { z } from 'zod'

export const BRIDGE_DEPOSITS_COLLECTION = 'bridgeDeposits'

const validatorConfirmationSchema = z.object({
  validatorAddress: z.string(),
  timestamp: z.string(),
})

export const bridgeDepositSchema = z.object({
  id: z.string(),
  // Numeric mirror of `id`, used only for sorting (ids are sequential, so
  // this doubles as recency order) — string comparison would sort "10000"
  // before "999", so a plain string index on `id` can't be used for that.
  idNum: z.number().int().nonnegative(),
  txid: z.string(),
  opIndex: z.number().int().nonnegative(),
  steemBlock: z.string(),
  steemTimestamp: z.string(),
  steemSender: z.string(),
  gatewayAccount: z.string(),
  amountMillisteem: z.string(),
  memo: z.string(),
  derivedDestination: z.string(),
  destinationType: z.string(),
  status: z.string(),
  minted: z.boolean(),
  mintedAt: z.string(),
  mintTxHash: z.string(),
  createdAtHeight: z.string(),
  validatorConfirmations: z.array(validatorConfirmationSchema),
  lastRefreshedAt: z.date(),
  asset: z.string(),
})

export type BridgeDepositDoc = z.infer<typeof bridgeDepositSchema>
