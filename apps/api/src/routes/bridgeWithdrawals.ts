import type { FastifyInstance } from 'fastify'
import type {
  BridgeAssetTotal,
  BridgeWithdrawal,
  BridgeWithdrawalStats,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  BRIDGE_WITHDRAWALS_COLLECTION,
  BridgeWithdrawalDoc,
} from '../db/schemas/bridgeWithdrawal.schema'
import { resolveValidatorMonikers } from '../db/validatorLookup'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

const STATUS_FILTER_MAP: Record<string, string> = {
  requested: 'WITHDRAWAL_STATUS_REQUESTED',
  processed: 'WITHDRAWAL_STATUS_PROCESSED',
  refunded: 'WITHDRAWAL_STATUS_REFUNDED',
}

function toWithdrawal(
  doc: BridgeWithdrawalDoc,
  monikers: Map<string, string>
): BridgeWithdrawal {
  return {
    id: doc.id,
    sender: doc.sender,
    destinationSteemAccount: doc.destinationSteemAccount,
    amountAsteem: doc.amountAsteem,
    amountMillisteem: doc.amountMillisteem,
    memo: doc.memo,
    burnTxHash: doc.burnTxHash,
    status: doc.status as BridgeWithdrawal['status'],
    createdAtHeight: doc.createdAtHeight,
    asset: doc.asset,
    feeMillisteem: doc.feeMillisteem,
    steemPayoutTxid: doc.steemPayoutTxid,
    payoutOpIndex: doc.payoutOpIndex,
    processedAtHeight: doc.processedAtHeight,
    refundedAtHeight: doc.refundedAtHeight,
    validatorConfirmations: doc.validatorConfirmations.map((c) => ({
      validatorAddress: c.validatorAddress,
      moniker: monikers.get(c.validatorAddress) ?? null,
      timestamp: c.timestamp,
    })),
  }
}

export function registerBridgeWithdrawalRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  const collection = db.collection<BridgeWithdrawalDoc>(
    BRIDGE_WITHDRAWALS_COLLECTION
  )

  app.get(
    '/bridge-withdrawals/stats',
    async (): Promise<BridgeWithdrawalStats> => {
      const [total, requested, processed, withdrawnByAsset] =
        await Promise.all([
          collection.countDocuments({}),
          collection.countDocuments({ status: 'WITHDRAWAL_STATUS_REQUESTED' }),
          collection.countDocuments({ status: 'WITHDRAWAL_STATUS_PROCESSED' }),
          // Not status-filtered — the burn already happened by the time a
          // withdrawal is indexed at all, regardless of what it's status
          // later becomes. $toDecimal avoids float precision loss.
          collection
            .aggregate<BridgeAssetTotal>([
              {
                $group: {
                  _id: '$asset',
                  sum: { $sum: { $toDecimal: '$amountMillisteem' } },
                },
              },
              {
                $project: {
                  _id: 0,
                  asset: '$_id',
                  amountMillisteem: { $toString: '$sum' },
                },
              },
              { $sort: { asset: 1 } },
            ])
            .toArray(),
        ])

      return { total, requested, processed, withdrawnByAsset }
    }
  )

  app.get<{ Querystring: PageQuery & { status?: string } }>(
    '/bridge-withdrawals',
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
        docs.map((doc) => toWithdrawal(doc, monikers)),
        page,
        perPage,
        total
      )
    }
  )

  app.get<{ Params: { idOrBurnTxHash: string } }>(
    '/bridge-withdrawals/:idOrBurnTxHash',
    async (request, reply) => {
      const { idOrBurnTxHash } = request.params
      const doc = await collection.findOne({
        $or: [{ id: idOrBurnTxHash }, { burnTxHash: idOrBurnTxHash }],
      })
      if (!doc) {
        return reply.status(404).send({ error: 'Bridge withdrawal not found' })
      }

      const monikers = await resolveValidatorMonikers(
        db,
        doc.validatorConfirmations.map((c) => c.validatorAddress)
      )
      return toWithdrawal(doc, monikers)
    }
  )
}
