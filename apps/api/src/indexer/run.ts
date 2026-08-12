import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { env } from '../config/env'
import { connectWithFailover } from '../chain/client'
import { getNetworkStatus } from '../chain/query'
import { ensureIndexes } from '../db/indexes'
import { syncDenomMetadataFromChain } from '../db/seed/denomMetadata.seed'
import { getOrCreateIndexerState, updateCheckpoint } from './checkpoint'
import { backfillRange } from './backfill'
import { startLiveTail } from './liveTail'
import { refreshValidators } from './validatorRefresh'
import { refreshParams } from './paramsRefresh'
import { refreshProposals } from './proposalRefresh'

export interface IndexerHandle {
  tmClient: Tendermint37Client
}

// Fast path: just enough to let the API server start accepting requests
// (health checks, live account/network lookups) — connect the chain client,
// make sure Mongo indexes/checkpoint doc exist. Deliberately does NOT touch
// backfill, which can take a long time on a chain with a lot of history and
// must not block the server from listening.
export async function connectIndexer(db: Db): Promise<IndexerHandle> {
  const rpcCandidates = [
    env.RPC_ADDRESS,
    env.RPC_ADDRESS_BACKUP_1,
    env.RPC_ADDRESS_BACKUP_2,
  ].filter((url): url is string => Boolean(url))

  const tmClient = await connectWithFailover(rpcCandidates)
  await ensureIndexes(db)

  const status = await getNetworkStatus(tmClient)
  const state = await getOrCreateIndexerState(db, status.chainId)
  if (!state.chainId) {
    await updateCheckpoint(db, { chainId: status.chainId })
  }

  return { tmClient }
}

// Slow path: backfill from genesis (or wherever the last run left off) to
// the current head, then switch to live-tailing new blocks, plus periodic
// low-churn refreshers. Runs in the background — call without awaiting so
// the API server can serve whatever's already indexed while this catches up.
export async function runIndexer(
  db: Db,
  tmClient: Tendermint37Client
): Promise<void> {
  await refreshParams(db, tmClient).catch((err) =>
    console.error('Initial params refresh failed:', err)
  )
  await syncDenomMetadataFromChain(db, tmClient).catch((err) =>
    console.error('Initial denom metadata sync failed:', err)
  )
  await refreshValidators(db, tmClient).catch((err) =>
    console.error('Initial validator refresh failed:', err)
  )
  await refreshProposals(db, tmClient).catch((err) =>
    console.error('Initial proposal refresh failed:', err)
  )

  const status = await getNetworkStatus(tmClient)
  const state = await getOrCreateIndexerState(db, status.chainId)
  const head = status.blockHeight
  const fromHeight = state.lastIndexedHeight + 1
  console.log(`Starting backfill from height ${fromHeight} to ${head}`)
  await backfillRange(db, tmClient, fromHeight, head)

  await updateCheckpoint(db, { mode: 'live', lastIndexedHeight: head })
  console.log('Backfill complete — switching to live tail')
  startLiveTail(db, tmClient)

  setInterval(() => {
    refreshValidators(db, tmClient).catch((err) =>
      console.error('Validator refresh failed:', err)
    )
  }, env.VALIDATOR_REFRESH_INTERVAL_MS)

  setInterval(() => {
    refreshParams(db, tmClient).catch((err) =>
      console.error('Params refresh failed:', err)
    )
  }, env.PARAMS_REFRESH_INTERVAL_MS)

  setInterval(() => {
    refreshProposals(db, tmClient).catch((err) =>
      console.error('Proposal refresh failed:', err)
    )
  }, env.PROPOSAL_REFRESH_INTERVAL_MS)
}
