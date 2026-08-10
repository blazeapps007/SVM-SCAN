import { z } from 'zod'

export const IBC_DENOM_TRACES_COLLECTION = 'ibcDenomTraces'

// Keyed by the full "ibc/<HASH>" denom. A trace is permanent once
// established (the hash is a deterministic function of the path + base
// denom), so this never needs invalidating.
export const ibcDenomTraceSchema = z.object({
  _id: z.string(),
  baseDenom: z.string(),
  path: z.string(),
  resolvedAt: z.date(),
})

export type IbcDenomTraceDoc = z.infer<typeof ibcDenomTraceSchema>
