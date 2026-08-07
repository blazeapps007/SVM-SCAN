import { z } from 'zod'

export const TRANSACTIONS_COLLECTION = 'transactions'

const eventAttributeSchema = z.object({
  key: z.string(),
  value: z.string(),
  index: z.boolean().optional(),
})

const eventSchema = z.object({
  type: z.string(),
  attributes: z.array(eventAttributeSchema),
})

const coinSchema = z.object({
  denom: z.string(),
  amount: z.string(),
})

const decodeMsgSchema = z.object({
  typeUrl: z.string(),
  data: z.unknown().nullable(),
})

const ibcTransferSchema = z.object({
  sender: z.string(),
  receiver: z.string(),
  sourceChannel: z.string(),
  sourcePort: z.string(),
  destinationChannel: z.string(),
  destinationPort: z.string(),
  amount: z.string(),
  denom: z.string(),
  memo: z.string(),
})

export const transactionSchema = z.object({
  hash: z.string(),
  height: z.number().int().nonnegative(),
  timestamp: z.date(),
  code: z.number().int(),
  log: z.string(),
  gasWanted: z.string(),
  gasUsed: z.string(),
  fee: z.array(coinSchema),
  memo: z.string(),
  messages: z.array(decodeMsgSchema),
  messageTypes: z.array(z.string()),
  events: z.array(eventSchema),
  senders: z.array(z.string()),
  ibcTransfer: ibcTransferSchema.nullable(),
})

export type TransactionDoc = z.infer<typeof transactionSchema>
