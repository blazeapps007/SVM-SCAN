import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { env } from '../config/env'
import { indexBlock } from './blockIndexer'
import { updateCheckpoint } from './checkpoint'

export async function backfillRange(
  db: Db,
  tmClient: Tendermint37Client,
  fromHeight: number,
  toHeight: number
): Promise<void> {
  if (fromHeight > toHeight) return

  const batchSize = env.BACKFILL_BATCH_SIZE
  const concurrency = env.BACKFILL_CONCURRENCY

  for (
    let batchStart = fromHeight;
    batchStart <= toHeight;
    batchStart += batchSize
  ) {
    const batchEnd = Math.min(batchStart + batchSize - 1, toHeight)
    const heights = Array.from(
      { length: batchEnd - batchStart + 1 },
      (_, i) => batchStart + i
    )

    for (let i = 0; i < heights.length; i += concurrency) {
      const chunk = heights.slice(i, i + concurrency)
      await Promise.all(chunk.map((height) => indexBlock(db, tmClient, height)))
    }

    console.log(`Indexed blocks ${batchStart}-${batchEnd} (of ${toHeight})`)
    await updateCheckpoint(db, { lastIndexedHeight: batchEnd })
  }
}
