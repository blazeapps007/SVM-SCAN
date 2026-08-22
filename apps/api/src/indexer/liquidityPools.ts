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

export interface EvmTxEnrichment {
  // gasUsed * effectiveGasPrice summed across every MsgEthereumTx message in
  // the tx, as a Coin — empty when there's nothing to report (no EVM
  // message, EVM_RPC_URL unset, or the receipt fetch failed). The outer
  // Cosmos tx's own auth_info.fee is always empty for a MsgEthereumTx on
  // this chain (the EVM ante handler deducts gas cost directly rather than
  // through the standard Cosmos fee field), so blockIndexer.ts uses this as
  // the tx doc's `fee` whenever the Cosmos-level fee came back empty.
  fee: { denom: string; amount: string }[]
}

// Called per indexed tx (backfill and live-tail both funnel through
// blockIndexer.ts) — for any MsgEthereumTx message, fetches its EVM receipt
// once and uses it for two things: computing the real gas fee paid (the
// receipt's effectiveGasPrice * gasUsed) and checking for a Uniswap
// V3-style PoolCreated log. Best-effort: a failure here must not break
// block indexing, since this is enrichment on top of the core tx/block
// data, not load-bearing for it.
export async function indexLiquidityPoolsForTx(
  db: Db,
  messages: DecodeMsg[],
  height: number,
  blockTime: Date
): Promise<EvmTxEnrichment> {
  if (!env.EVM_RPC_URL) return { fee: [] }

  const ethHashes = messages
    .filter((m) => m.typeUrl === ETH_TX_TYPE)
    .map((m) => (m.data as { hash?: string } | null)?.hash)
    .filter((hash): hash is string => Boolean(hash))

  if (ethHashes.length === 0) return { fee: [] }

  const collection = db.collection<LiquidityPoolDoc>(LIQUIDITY_POOLS_COLLECTION)
  let totalFee = 0n

  for (const ethHash of ethHashes) {
    try {
      const receipt = await getEthTransactionReceipt(env.EVM_RPC_URL, ethHash)
      if (!receipt) continue

      totalFee +=
        BigInt(receipt.gasUsed || '0x0') *
        BigInt(receipt.effectiveGasPrice || '0x0')

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

  return {
    fee: totalFee > 0n ? [{ denom: 'asteem', amount: totalFee.toString() }] : [],
  }
}
