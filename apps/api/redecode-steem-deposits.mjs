import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { Tendermint37Client, WebsocketClient } from '@cosmjs/tendermint-rpc'
import { Tx } from 'cosmjs-types/cosmos/tx/v1beta1/tx.js'
import { decodeMsg } from '@dexplorer/shared'

const TYPE_URL = '/steemvm.steembridge.v1.MsgSubmitSteemDeposit'

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI)
  await mongo.connect()
  const db = mongo.db()
  const collection = db.collection('transactions')

  const wsClient = new WebsocketClient(
    process.env.RPC_ADDRESS.replace('http', 'ws') + '/websocket',
    (err) => console.error('ws error', err)
  )
  const tmClient = await Tendermint37Client.create(wsClient)

  const docs = await collection
    .find({ messageTypes: TYPE_URL })
    .toArray()
  console.log(`Found ${docs.length} historical MsgSubmitSteemDeposit txs to redecode`)

  let updated = 0
  for (const doc of docs) {
    try {
      const hashBytes = Buffer.from(doc.hash, 'hex')
      const result = await tmClient.tx({ hash: hashBytes })
      const tx = Tx.decode(result.tx)
      const messages = tx.body.messages.map((m) => decodeMsg(m.typeUrl, m.value))
      await collection.updateOne({ hash: doc.hash }, { $set: { messages } })
      updated += 1
    } catch (err) {
      console.error(`Failed to redecode ${doc.hash}:`, err.message)
    }
  }
  console.log(`Redecoded ${updated}/${docs.length} transactions`)

  tmClient.disconnect()
  await mongo.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
