import { z } from 'zod'

export const PROPOSALS_COLLECTION = 'proposals'

const coinSchema = z.object({
  denom: z.string(),
  amount: z.string(),
})

const decodeMsgSchema = z.object({
  typeUrl: z.string(),
  data: z.unknown().nullable(),
})

const tallyResultSchema = z.object({
  yesCount: z.string(),
  noCount: z.string(),
  abstainCount: z.string(),
  noWithVetoCount: z.string(),
})

export const proposalSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  summary: z.string(),
  status: z.string(),
  proposer: z.string(),
  messages: z.array(decodeMsgSchema),
  submitTime: z.date().nullable(),
  depositEndTime: z.date().nullable(),
  votingStartTime: z.date().nullable(),
  votingEndTime: z.date().nullable(),
  totalDeposit: z.array(coinSchema),
  finalTallyResult: tallyResultSchema.nullable(),
  expedited: z.boolean(),
  failedReason: z.string(),
  lastRefreshedAt: z.date(),
})

export type ProposalDoc = z.infer<typeof proposalSchema>
