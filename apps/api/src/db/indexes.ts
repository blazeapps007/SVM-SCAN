import { Db } from 'mongodb'
import { BLOCKS_COLLECTION } from './schemas/block.schema'
import { TRANSACTIONS_COLLECTION } from './schemas/transaction.schema'
import { VALIDATORS_COLLECTION } from './schemas/validator.schema'
import { PROPOSALS_COLLECTION } from './schemas/proposal.schema'
import { LIQUIDITY_POOLS_COLLECTION } from './schemas/liquidityPool.schema'
import { BRIDGE_DEPOSITS_COLLECTION } from './schemas/bridgeDeposit.schema'
import { BRIDGE_WITHDRAWALS_COLLECTION } from './schemas/bridgeWithdrawal.schema'

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection(BLOCKS_COLLECTION).createIndexes([
    { key: { height: 1 }, unique: true, name: 'height_unique' },
    { key: { hash: 1 }, unique: true, name: 'hash_unique' },
    { key: { time: -1 }, name: 'time_desc' },
  ])

  await db.collection(TRANSACTIONS_COLLECTION).createIndexes([
    { key: { hash: 1 }, unique: true, name: 'hash_unique' },
    { key: { height: 1 }, name: 'height' },
    { key: { timestamp: -1 }, name: 'timestamp_desc' },
    { key: { senders: 1 }, name: 'senders' },
    {
      key: { ibcTransfer: 1 },
      name: 'ibc_transfer_sparse',
      sparse: true,
    },
  ])

  await db.collection(VALIDATORS_COLLECTION).createIndexes([
    {
      key: { operatorAddress: 1 },
      unique: true,
      name: 'operator_address_unique',
    },
    { key: { identity: 1 }, name: 'identity' },
    { key: { status: 1, tokens: -1 }, name: 'status_tokens_desc' },
  ])

  await db.collection(PROPOSALS_COLLECTION).createIndexes([
    { key: { id: 1 }, unique: true, name: 'id_unique' },
    { key: { status: 1 }, name: 'status' },
    { key: { votingEndTime: -1 }, name: 'voting_end_time_desc' },
  ])

  await db.collection(LIQUIDITY_POOLS_COLLECTION).createIndexes([
    { key: { poolAddress: 1 }, unique: true, name: 'pool_address_unique' },
    { key: { createdAt: -1 }, name: 'created_at_desc' },
  ])

  await db.collection(BRIDGE_DEPOSITS_COLLECTION).createIndexes([
    { key: { id: 1 }, unique: true, name: 'id_unique' },
    { key: { txid: 1 }, name: 'txid' },
    { key: { status: 1 }, name: 'status' },
    { key: { idNum: -1 }, name: 'id_num_desc' },
  ])

  await db.collection(BRIDGE_WITHDRAWALS_COLLECTION).createIndexes([
    { key: { id: 1 }, unique: true, name: 'id_unique' },
    { key: { burnTxHash: 1 }, name: 'burn_tx_hash' },
    { key: { status: 1 }, name: 'status' },
    { key: { idNum: -1 }, name: 'id_num_desc' },
  ])
}
