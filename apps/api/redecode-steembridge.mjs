// One-off migration: redecode historical steembridge txs (MsgSubmitSteemDeposit,
// MsgBridgeOut) that were indexed before their named decoders existed, so they
// show proper fields instead of field_1/field_2/etc. Uses the chain's LCD REST
// API (already-decoded JSON, since the chain has proto reflection for this
// custom module) via plain concurrent fetch — deliberately NOT the Tendermint
// RPC tmClient, to avoid competing with the live dev server's single websocket
// connection (a prior attempt using tmClient.tx() one-at-a-time caused RPC
// contention and was far too slow — killed after ~20min having only processed
// 14/7642).
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const LCD_URL = process.env.STEEMBRIDGE_LCD_URL
const CONCURRENCY = 20

const DEPOSIT_TYPE = '/steemvm.steembridge.v1.MsgSubmitSteemDeposit'
const BRIDGE_OUT_TYPE = '/steemvm.steembridge.v1.MsgBridgeOut'

function mapMessage(raw) {
  if (raw['@type'] === DEPOSIT_TYPE) {
    return {
      typeUrl: DEPOSIT_TYPE,
      data: {
        validator: raw.validator ?? '',
        txid: raw.txid ?? '',
        opIndex: raw.op_index ?? 0,
        steemBlock: raw.steem_block ?? '0',
        steemTimestamp: raw.steem_timestamp ?? '',
        steemSender: raw.steem_sender ?? '',
        gatewayAccount: raw.gateway_account ?? '',
        amountMillisteem: raw.amount_millisteem ?? '0',
        memo: raw.memo ?? '',
      },
    }
  }
  if (raw['@type'] === BRIDGE_OUT_TYPE) {
    return {
      typeUrl: BRIDGE_OUT_TYPE,
      data: {
        sender: raw.sender ?? '',
        destinationSteemAccount: raw.destination_steem_account ?? '',
        amountAsteem: raw.amount_asteem ?? '0',
        memo: raw.memo ?? '',
      },
    }
  }
  return null
}

async function runPool(items, worker, concurrency) {
  let index = 0
  let done = 0
  let failed = 0
  async function next() {
    while (index < items.length) {
      const i = index
      index += 1
      try {
        await worker(items[i])
      } catch (err) {
        failed += 1
        console.error(`Failed ${items[i]}:`, err.message)
      }
      done += 1
      if (done % 200 === 0) console.log(`Progress: ${done}/${items.length}`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
  return { done, failed }
}

async function main() {
  if (!LCD_URL) throw new Error('STEEMBRIDGE_LCD_URL not set')

  const mongo = new MongoClient(process.env.MONGODB_URI)
  await mongo.connect()
  const db = mongo.db()
  const collection = db.collection('transactions')

  const docs = await collection
    .find(
      {
        messageTypes: { $in: [DEPOSIT_TYPE, BRIDGE_OUT_TYPE] },
        $or: [
          { 'messages.data.field_1': { $exists: true } },
        ],
      },
      { projection: { hash: 1 } }
    )
    .toArray()

  console.log(`Found ${docs.length} historical steembridge txs to redecode`)

  const { done, failed } = await runPool(
    docs.map((d) => d.hash),
    async (hash) => {
      const res = await fetch(`${LCD_URL}/cosmos/tx/v1beta1/txs/${hash}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rawMessages = json.tx?.body?.messages ?? []
      const messages = rawMessages.map((m) => mapMessage(m) ?? { typeUrl: m['@type'], data: null })
      await collection.updateOne({ hash }, { $set: { messages } })
    },
    CONCURRENCY
  )

  console.log(`Redecoded ${done - failed}/${docs.length} transactions (${failed} failed)`)

  await mongo.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
