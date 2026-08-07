import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { subscribeNewBlock } from '../chain/subscribe'
import { indexBlock } from './blockIndexer'
import { backfillRange } from './backfill'
import { updateCheckpoint, getOrCreateIndexerState } from './checkpoint'

export function startLiveTail(db: Db, tmClient: Tendermint37Client): void {
  subscribeNewBlock(
    tmClient,
    (event) => {
      const height = Number(event.header.height)
      void handleNewBlock(db, tmClient, height)
    },
    (err) => {
      console.error(
        'Live tail block subscription error, will rely on next reconnect:',
        err
      )
    }
  )
}

async function handleNewBlock(
  db: Db,
  tmClient: Tendermint37Client,
  height: number
): Promise<void> {
  try {
    const state = await getOrCreateIndexerState(db, '')

    // A gap means we missed blocks (e.g. a dropped subscription) — backfill
    // the missing range before writing this one, keeping heights contiguous.
    if (height > state.lastIndexedHeight + 1) {
      await backfillRange(db, tmClient, state.lastIndexedHeight + 1, height - 1)
    }

    await indexBlock(db, tmClient, height)
    await updateCheckpoint(db, { lastIndexedHeight: height, mode: 'live' })
  } catch (err) {
    console.error(`Failed to index live block ${height}:`, err)
  }
}
