import { Db } from 'mongodb'
import { env } from '../config/env'
import {
  fetchDeposits,
  fetchPendingDeposits,
  RawSteemBridgeDeposit,
} from '../chain/steembridgeLcd'
import {
  BRIDGE_DEPOSITS_COLLECTION,
  BridgeDepositDoc,
} from '../db/schemas/bridgeDeposit.schema'

const FULL_WALK_PAGE_SIZE = 100
const NEWEST_PAGE_SIZE = 50

function toDoc(raw: RawSteemBridgeDeposit, now: Date): BridgeDepositDoc {
  return {
    id: raw.id,
    idNum: Number(raw.id),
    txid: raw.txid,
    opIndex: raw.op_index,
    steemBlock: raw.steem_block,
    steemTimestamp: raw.steem_timestamp,
    steemSender: raw.steem_sender,
    gatewayAccount: raw.gateway_account,
    amountMillisteem: raw.amount_millisteem,
    memo: raw.memo,
    derivedDestination: raw.derived_destination,
    destinationType: raw.destination_type,
    status: raw.status,
    minted: raw.minted,
    mintedAt: raw.minted_at,
    mintTxHash: raw.mint_tx_hash,
    createdAtHeight: raw.created_at,
    validatorConfirmations: raw.validator_confirmations.map((c) => ({
      validatorAddress: c.validator_address,
      timestamp: c.timestamp,
    })),
    lastRefreshedAt: now,
    asset: raw.asset,
  }
}

async function upsertDeposits(
  db: Db,
  items: RawSteemBridgeDeposit[]
): Promise<void> {
  if (items.length === 0) return
  const now = new Date()
  const collection = db.collection<BridgeDepositDoc>(BRIDGE_DEPOSITS_COLLECTION)
  await Promise.all(
    items.map((raw) =>
      collection.updateOne(
        { id: raw.id },
        { $set: toDoc(raw, now) },
        { upsert: true }
      )
    )
  )
}

// One-time full history catch-up, only run while the collection is empty —
// walks /deposit forward page by page until exhausted. Not resumable via a
// checkpoint if interrupted (acceptable for Phase 1: ~19 pages total at this
// chain's current scale) — a restart just re-walks from the start since the
// collection is still empty at that point, and upserts are idempotent.
async function backfillAllDeposits(db: Db, lcdUrl: string): Promise<void> {
  let key: string | undefined
  for (;;) {
    const page = await fetchDeposits(lcdUrl, {
      limit: FULL_WALK_PAGE_SIZE,
      key,
    })
    await upsertDeposits(db, page.items)
    if (!page.nextKey || page.items.length === 0) break
    key = page.nextKey
  }
}

// Periodic refresh: cheap enough to run every tick without re-walking the
// whole (and growing) deposit list —
//   - /pending_deposits is small and covers everything whose data can still
//     change (new confirmations, status flipping to minted/unclaimable).
//   - the newest page of /deposit (reverse=true) catches brand-new deposits
//     since the last tick.
export async function refreshBridgeDeposits(db: Db): Promise<void> {
  if (!env.STEEMBRIDGE_LCD_URL) return
  const lcdUrl = env.STEEMBRIDGE_LCD_URL

  const collection = db.collection<BridgeDepositDoc>(BRIDGE_DEPOSITS_COLLECTION)
  const isEmpty = (await collection.countDocuments({}, { limit: 1 })) === 0
  if (isEmpty) {
    await backfillAllDeposits(db, lcdUrl)
  }

  let pendingKey: string | undefined
  for (;;) {
    const page = await fetchPendingDeposits(lcdUrl, {
      limit: FULL_WALK_PAGE_SIZE,
      key: pendingKey,
    })
    await upsertDeposits(db, page.items)
    if (!page.nextKey || page.items.length === 0) break
    pendingKey = page.nextKey
  }

  const newest = await fetchDeposits(lcdUrl, {
    limit: NEWEST_PAGE_SIZE,
    reverse: true,
  })
  await upsertDeposits(db, newest.items)
}
