import { Db } from 'mongodb'
import { env } from '../config/env'
import {
  decodePoolCreatedLogs,
  getErc20Metadata,
  getEthTransactionReceipt,
} from '../chain/evmRpc'
import {
  LIQUIDITY_POOLS_COLLECTION,
  LiquidityPoolDoc,
} from '../db/schemas/liquidityPool.schema'
import type { DecodeMsg } from '@dexplorer/shared'

const ETH_TX_TYPE = '/cosmos.evm.vm.v1.MsgEthereumTx'

// Called per indexed tx (backfill and live-tail both funnel through
// blockIndexer.ts) — for any MsgEthereumTx message, fetches its EVM receipt
// and checks for a Uniswap V3-style PoolCreated log. Best-effort: a failure
// here must not break block indexing, since this is enrichment on top of
// the core tx/block data, not load-bearing for it.
export async function indexLiquidityPoolsForTx(
  db: Db,
  messages: DecodeMsg[],
  height: number,
  blockTime: Date
): Promise<void> {
  if (!env.EVM_RPC_URL) return

  const ethHashes = messages
    .filter((m) => m.typeUrl === ETH_TX_TYPE)
    .map((m) => (m.data as { hash?: string } | null)?.hash)
    .filter((hash): hash is string => Boolean(hash))

  if (ethHashes.length === 0) return

  const collection = db.collection<LiquidityPoolDoc>(LIQUIDITY_POOLS_COLLECTION)

  for (const ethHash of ethHashes) {
    try {
      const receipt = await getEthTransactionReceipt(env.EVM_RPC_URL, ethHash)
      if (!receipt) continue

      const pools = decodePoolCreatedLogs(receipt.logs)
      if (pools.length === 0) continue

      for (const pool of pools) {
        const [token0Meta, token1Meta] = await Promise.all([
          getErc20Metadata(env.EVM_RPC_URL, pool.token0),
          getErc20Metadata(env.EVM_RPC_URL, pool.token1),
        ])

        const doc: LiquidityPoolDoc = {
          poolAddress: pool.poolAddress,
          factoryAddress: pool.factoryAddress,
          token0Address: pool.token0,
          token1Address: pool.token1,
          token0: token0Meta,
          token1: token1Meta,
          fee: pool.fee,
          tickSpacing: pool.tickSpacing,
          createdAtHeight: height,
          createdAtTxHash: ethHash,
          createdAt: blockTime,
        }

        await collection.updateOne(
          { poolAddress: doc.poolAddress },
          { $set: doc },
          { upsert: true }
        )
      }
    } catch (err) {
      console.error(
        `Failed to index liquidity pools for EVM tx ${ethHash} at height ${height}:`,
        err
      )
    }
  }
}
