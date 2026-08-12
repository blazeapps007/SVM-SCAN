import 'dotenv/config'
import { MongoClient } from 'mongodb'

const mongo = new MongoClient(process.env.MONGODB_URI)
await mongo.connect()
const db = mongo.db()
const collection = db.collection('transactions')

const total = await collection.countDocuments({
  messageTypes: '/steemvm.steembridge.v1.MsgSubmitSteemDeposit',
})
const stillOld = await collection.countDocuments({
  messageTypes: '/steemvm.steembridge.v1.MsgSubmitSteemDeposit',
  'messages.data.field_1': { $exists: true },
})
console.log(`total: ${total}, still old-shaped: ${stillOld}, redecoded: ${total - stillOld}`)

await mongo.close()
