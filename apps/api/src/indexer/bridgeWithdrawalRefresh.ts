import { Db } from 'mongodb'
import { env } from '../config/env'
import {
  fetchWithdrawals,
  RawSteemBridgeWithdrawal,
} from '../chain/steembridgeLcd'
import {
  BRIDGE_WITHDRAWALS_COLLECTION,
  BridgeWithdrawalDoc,
} from '../db/schemas/bridgeWithdrawal.schema'

const PAGE_SIZE = 100

function toDoc(raw: RawSteemBridgeWithdrawal, now: Date): BridgeWithdrawalDoc {
  return {
    id: raw.id,
    idNum: Number(raw.id),
    sender: raw.sender,
    destinationSteemAccount: raw.destination_steem_account,
    amountAsteem: raw.amount_asteem,
    amountMillisteem: raw.amount_millisteem,
    memo: raw.memo,
    burnTxHash: raw.burn_tx_hash,
    status: raw.status,
    createdAtHeight: raw.created_at,
    lastRefreshedAt: now,
    asset: raw.asset,
    feeMillisteem: raw.fee_millisteem,
    steemPayoutTxid: raw.steem_payout_txid,
    payoutOpIndex: raw.payout_op_index,
    processedAtHeight: raw.processed_at,
    refundedAtHeight: raw.refunded_at,
    validatorConfirmations: raw.validator_confirmations.map((c) => ({
      validatorAddress: c.validator_address,
      timestamp: c.timestamp,
    })),
  }
}

// Unlike bridgeDepositRefresh.ts, withdrawals are currently a tiny dataset
// (a handful of records total) — the deposit-style "pending queue + newest
// page" split would be premature optimization here. Just do a full forward
// walk every tick, same shape as validatorRefresh.ts/proposalRefresh.ts.
// Revisit with the deposit-style split if withdrawal volume grows
// significantly.
export async function refreshBridgeWithdrawals(db: Db): Promise<void> {
  if (!env.STEEMBRIDGE_LCD_URL) return
  const lcdUrl = env.STEEMBRIDGE_LCD_URL

  const now = new Date()
  const collection = db.collection<BridgeWithdrawalDoc>(
    BRIDGE_WITHDRAWALS_COLLECTION
  )

  let key: string | undefined
  for (;;) {
    const page = await fetchWithdrawals(lcdUrl, { limit: PAGE_SIZE, key })
    if (page.items.length > 0) {
      await Promise.all(
        page.items.map((raw) =>
          collection.updateOne(
            { id: raw.id },
            { $set: toDoc(raw, now) },
            { upsert: true }
          )
        )
      )
    }
    if (!page.nextKey || page.items.length === 0) break
    key = page.nextKey
  }
}
