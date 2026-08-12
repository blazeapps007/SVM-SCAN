import type { FastifyInstance } from 'fastify'
import type { BridgeDeposit, BridgeDepositStats } from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  BRIDGE_DEPOSITS_COLLECTION,
  BridgeDepositDoc,
} from '../db/schemas/bridgeDeposit.schema'
import { resolveValidatorMonikers } from '../db/validatorLookup'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

const STATUS_FILTER_MAP: Record<string, string> = {
  pending: 'DEPOSIT_STATUS_PENDING',
  minted: 'DEPOSIT_STATUS_MINTED',
  unclaimable: 'DEPOSIT_STATUS_UNCLAIMABLE',
}

// The Steem chain's LCD returns steem_timestamp with no timezone designator
// (e.g. "2026-08-12T00:31:36") even though it's UTC — parsed as-is by
// JS/dayjs that reads as local time, throwing off every "time ago" display
// by the visitor's UTC offset. Normalize once here rather than at every
// display call site.
function toUtcIsoString(raw: string): string {
  return /[Zz]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`
}

function toDeposit(
  doc: BridgeDepositDoc,
  monikers: Map<string, string>
): BridgeDeposit {
  return {
    id: doc.id,
    txid: doc.txid,
    opIndex: doc.opIndex,
    steemBlock: doc.steemBlock,
    steemTimestamp: toUtcIsoString(doc.steemTimestamp),
    steemSender: doc.steemSender,
    gatewayAccount: doc.gatewayAccount,
    amountMillisteem: doc.amountMillisteem,
    memo: doc.memo,
    derivedDestination: doc.derivedDestination,
    destinationType: doc.destinationType as BridgeDeposit['destinationType'],
    status: doc.status as BridgeDeposit['status'],
    minted: doc.minted,
    mintedAt: doc.mintedAt,
    mintTxHash: doc.mintTxHash,
    createdAtHeight: doc.createdAtHeight,
    validatorConfirmations: doc.validatorConfirmations.map((c) => ({
      validatorAddress: c.validatorAddress,
      moniker: monikers.get(c.validatorAddress) ?? null,
      timestamp: c.timestamp,
    })),
  }
}

export function registerBridgeDepositRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  const collection = db.collection<BridgeDepositDoc>(BRIDGE_DEPOSITS_COLLECTION)

  app.get('/bridge-deposits/stats', async (): Promise<BridgeDepositStats> => {
    const [pending, minted, unclaimable, total] = await Promise.all([
      collection.countDocuments({ status: 'DEPOSIT_STATUS_PENDING' }),
      collection.countDocuments({ status: 'DEPOSIT_STATUS_MINTED' }),
      collection.countDocuments({ status: 'DEPOSIT_STATUS_UNCLAIMABLE' }),
      collection.countDocuments({}),
    ])
    return { pending, minted, unclaimable, total }
  })

  app.get<{ Querystring: PageQuery & { status?: string } }>(
    '/bridge-deposits',
    async (request) => {
      const { page, perPage, skip } = parsePagination(request.query, 25)
      const status = request.query.status
        ? STATUS_FILTER_MAP[request.query.status]
        : undefined
      const filter = status ? { status } : {}

      const [docs, total] = await Promise.all([
        collection
          .find(filter)
          .sort({ idNum: -1 })
          .skip(skip)
          .limit(perPage)
          .toArray(),
        collection.countDocuments(filter),
      ])

      const monikers = await resolveValidatorMonikers(
        db,
        docs.flatMap((doc) =>
          doc.validatorConfirmations.map((c) => c.validatorAddress)
        )
      )

      return paginatedResponse(
        docs.map((doc) => toDeposit(doc, monikers)),
        page,
        perPage,
        total
      )
    }
  )

  app.get<{ Params: { idOrTxid: string } }>(
    '/bridge-deposits/:idOrTxid',
    async (request, reply) => {
      const { idOrTxid } = request.params
      const doc = await collection.findOne({
        $or: [{ id: idOrTxid }, { txid: idOrTxid }],
      })
      if (!doc) {
        return reply.status(404).send({ error: 'Bridge deposit not found' })
      }

      const monikers = await resolveValidatorMonikers(
        db,
        doc.validatorConfirmations.map((c) => c.validatorAddress)
      )
      return toDeposit(doc, monikers)
    }
  )
}
