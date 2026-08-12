import { z } from 'zod'

export const BRIDGE_WITHDRAWALS_COLLECTION = 'bridgeWithdrawals'

export const bridgeWithdrawalSchema = z.object({
  id: z.string(),
  // Numeric mirror of `id`, used only for sorting — see the same field on
  // bridgeDeposit.schema.ts for why a plain string index can't be used.
  idNum: z.number().int().nonnegative(),
  sender: z.string(),
  destinationSteemAccount: z.string(),
  amountAsteem: z.string(),
  amountMillisteem: z.string(),
  memo: z.string(),
  burnTxHash: z.string(),
  status: z.string(),
  createdAtHeight: z.string(),
  lastRefreshedAt: z.date(),
})

export type BridgeWithdrawalDoc = z.infer<typeof bridgeWithdrawalSchema>
