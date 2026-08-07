import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { sha256 } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'
import { Tx } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import {
  decodeMsg,
  getSendersFromEvents,
  type DecodeMsg,
} from '@dexplorer/shared'
import { getBlock, getBlockResults } from '../chain/query'
import { BLOCKS_COLLECTION, BlockDoc } from '../db/schemas/block.schema'
import {
  TRANSACTIONS_COLLECTION,
  TransactionDoc,
} from '../db/schemas/transaction.schema'
import { extractIBCTransfer } from './ibcTransfer'

interface TxEventLike {
  type: string
  attributes: { key: string; value: string; index?: boolean }[]
}

function decodeEvents(
  events: readonly {
    type: string
    attributes: readonly {
      key: Uint8Array | string
      value: Uint8Array | string
      index?: boolean
    }[]
  }[]
): TxEventLike[] {
  const decode = (v: Uint8Array | string): string =>
    typeof v === 'string' ? v : Buffer.from(v).toString('utf8')

  return events.map((event) => ({
    type: event.type,
    attributes: event.attributes.map((attr) => ({
      key: decode(attr.key),
      value: decode(attr.value),
      index: attr.index,
    })),
  }))
}

export async function indexBlock(
  db: Db,
  tmClient: Tendermint37Client,
  height: number
): Promise<void> {
  const [block, blockResults] = await Promise.all([
    getBlock(tmClient, height),
    getBlockResults(tmClient, height),
  ])

  const rawTxs = block.txs
  const txResults = blockResults.results

  const txDocs: TransactionDoc[] = []
  const txHashes: string[] = []

  for (let i = 0; i < rawTxs.length; i++) {
    const rawTx = rawTxs[i]
    const result = txResults[i]
    const hash = toHex(sha256(rawTx)).toUpperCase()
    txHashes.push(hash)

    let messages: DecodeMsg[] = []
    let memo = ''
    let fee: { denom: string; amount: string }[] = []
    try {
      const decodedTx = Tx.decode(rawTx)
      memo = decodedTx.body?.memo ?? ''
      fee = (decodedTx.authInfo?.fee?.amount ?? []).map((coin) => ({
        denom: coin.denom,
        amount: coin.amount,
      }))
      messages = (decodedTx.body?.messages ?? []).map((msg) =>
        decodeMsg(msg.typeUrl, msg.value)
      )
    } catch (err) {
      console.error(`Failed to decode tx ${hash} at height ${height}:`, err)
    }

    const events = result ? decodeEvents(result.events) : []
    const senders = getSendersFromEvents(events)
    const ibcTransfer = extractIBCTransfer(events)

    txDocs.push({
      hash,
      height,
      timestamp: new Date(block.header.time),
      code: result?.code ?? 0,
      log: result?.log ?? '',
      gasWanted: (result?.gasWanted ?? 0n).toString(),
      gasUsed: (result?.gasUsed ?? 0n).toString(),
      fee,
      memo,
      messages,
      messageTypes: messages.map((m) => m.typeUrl),
      events,
      senders,
      ibcTransfer,
    })
  }

  const blockHash =
    typeof block.id === 'string'
      ? block.id
      : toHex(block.id as unknown as Uint8Array)

  const blockDoc: BlockDoc = {
    height,
    hash: blockHash.toUpperCase(),
    time: new Date(block.header.time),
    proposerAddress: toHex(block.header.proposerAddress).toUpperCase(),
    appHash: toHex(block.header.appHash).toUpperCase(),
    txCount: rawTxs.length,
    txHashes,
  }

  await db
    .collection<BlockDoc>(BLOCKS_COLLECTION)
    .updateOne({ height }, { $set: blockDoc }, { upsert: true })

  if (txDocs.length > 0) {
    const txCollection = db.collection<TransactionDoc>(TRANSACTIONS_COLLECTION)
    await Promise.all(
      txDocs.map((doc) =>
        txCollection.updateOne(
          { hash: doc.hash },
          { $set: doc },
          { upsert: true }
        )
      )
    )
  }
}
