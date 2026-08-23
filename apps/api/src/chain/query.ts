import {
  Account,
  Block,
  Coin,
  IndexedTx,
  StargateClient,
} from '@cosmjs/stargate'
import {
  Tendermint37Client,
  ValidatorsResponse,
  BlockResultsResponse,
} from '@cosmjs/tendermint-rpc'
import { env } from '../config/env'
import { withTimeout } from './withTimeout'
import { withChainTimeout } from './connectionHealth'

const clientCache = new WeakMap<Tendermint37Client, Promise<StargateClient>>()

async function getClient(
  tmClient: Tendermint37Client
): Promise<StargateClient> {
  if (!clientCache.has(tmClient)) {
    clientCache.set(
      tmClient,
      withChainTimeout(
        StargateClient.create(tmClient),
        'StargateClient.create'
      )
    )
  }
  return clientCache.get(tmClient)!
}

export async function getChainId(
  tmClient: Tendermint37Client
): Promise<string> {
  const client = await getClient(tmClient)
  return withChainTimeout(client.getChainId(), 'getChainId')
}

export async function getNetworkStatus(tmClient: Tendermint37Client): Promise<{
  chainId: string
  blockHeight: number
  catchingUp: boolean
  peered: number
  blockInterval: string
}> {
  const status = await withChainTimeout(tmClient.status(), 'status')
  const chainId = status.nodeInfo.network
  const syncInfo = status.syncInfo
  const blockHeight = Number(syncInfo.latestBlockHeight)

  // Average block time = time span between the node's earliest and latest
  // retained blocks, divided by the number of blocks between them — NOT
  // just the raw time span, since a node retaining full history back to
  // genesis would otherwise report the chain's entire age as its "block
  // interval".
  let blockInterval = '< 1s'
  const earliestHeight = Number(syncInfo.earliestBlockHeight)
  const heightSpan = blockHeight - earliestHeight
  if (
    syncInfo.latestBlockTime &&
    syncInfo.earliestBlockTime &&
    heightSpan > 0
  ) {
    const latestTime = new Date(syncInfo.latestBlockTime.toString()).getTime()
    const earliestTime = new Date(
      syncInfo.earliestBlockTime.toString()
    ).getTime()
    const interval = (latestTime - earliestTime) / 1000 / heightSpan
    blockInterval = interval < 1 ? '< 1s' : `${interval.toFixed(1)}s`
  }

  let peered = 0
  try {
    // Plain fetch() has no default timeout in Node — without withTimeout
    // here, a dropped connection would hang this forever even though the
    // tmClient.status() call above already succeeded.
    const response = await withTimeout(
      fetch(env.RPC_ADDRESS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'netinfo',
          method: 'net_info',
          params: {},
        }),
      }),
      'net_info'
    )
    const data = (await response.json()) as {
      result?: { n_peers?: number | string }
    }
    if (data.result?.n_peers !== undefined) {
      peered = Number(data.result.n_peers) || 0
    }
  } catch {
    // net_info request failed, leave peered as 0
  }

  return {
    chainId,
    blockHeight,
    catchingUp: syncInfo.catchingUp,
    peered,
    blockInterval,
  }
}

export async function getValidators(
  tmClient: Tendermint37Client
): Promise<ValidatorsResponse> {
  return withChainTimeout(tmClient.validatorsAll(), 'validatorsAll')
}

export type BlockHeaderWithRawFields = Block['header'] & {
  appHash: Uint8Array
  proposerAddress: Uint8Array
}

export type BlockWithRawHeader = Omit<Block, 'header'> & {
  header: BlockHeaderWithRawFields
}

export async function getBlock(
  tmClient: Tendermint37Client,
  height: number
): Promise<BlockWithRawHeader> {
  const client = await getClient(tmClient)
  const [block, rawBlock] = await withChainTimeout(
    Promise.all([client.getBlock(height), tmClient.block(height)]),
    `getBlock(${height})`
  )

  const header: BlockHeaderWithRawFields = {
    ...block.header,
    appHash: rawBlock.block.header.appHash,
    proposerAddress: rawBlock.block.header.proposerAddress,
  }

  return { ...block, header }
}

export async function getBlockResults(
  tmClient: Tendermint37Client,
  height: number
): Promise<BlockResultsResponse> {
  return withChainTimeout(
    tmClient.blockResults(height),
    `blockResults(${height})`
  )
}

export interface RawBlockEvent {
  type: string
  attributes: { key: string; value: string }[]
}

// CometBFT 0.38 (which this chain runs — its SDK modules use
// cosmossdk.io/core/appmodule's HasBeginBlocker/HasEndBlocker, ABCI 2.0)
// merged the old separate BeginBlock/EndBlock ABCI calls into one
// FinalizeBlock call. Its `block_results` RPC response carries the combined
// non-tx events under `finalize_block_events` — @cosmjs/tendermint-rpc's
// Tendermint37Client only looks for the older, separate
// `begin_block_events`/`end_block_events` fields (see getBlockResults
// above), which this node's responses no longer populate, so
// BlockResultsResponse.beginBlockEvents/endBlockEvents always come back
// empty here. This raw JSON-RPC call is the only way to reach those events
// (e.g. the STEEMBLACKHOLE burn-sweep's "burn" event, see
// indexer/burnEvents.ts) until @cosmjs/tendermint-rpc ships a comet38-aware
// client this codebase adopts. Best-effort like getNetworkStatus's net_info
// call below — no RPC failover, returns [] rather than throwing.
export async function getFinalizeBlockEvents(
  height: number
): Promise<RawBlockEvent[]> {
  try {
    const response = await withTimeout(
      fetch(env.RPC_ADDRESS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'block_results',
          method: 'block_results',
          params: { height: String(height) },
        }),
      }),
      `block_results(${height})`
    )
    const data = (await response.json()) as {
      result?: { finalize_block_events?: RawBlockEvent[] }
    }
    return data.result?.finalize_block_events ?? []
  } catch {
    return []
  }
}

export async function getTx(
  tmClient: Tendermint37Client,
  hash: string
): Promise<IndexedTx | null> {
  const client = await getClient(tmClient)
  return withChainTimeout(client.getTx(hash), 'getTx')
}

export async function getAccount(
  tmClient: Tendermint37Client,
  address: string
): Promise<Account | null> {
  const client = await getClient(tmClient)
  return withChainTimeout(client.getAccount(address), 'getAccount')
}

export async function getAllBalances(
  tmClient: Tendermint37Client,
  address: string
): Promise<readonly Coin[]> {
  const client = await getClient(tmClient)
  return withChainTimeout(client.getAllBalances(address), 'getAllBalances')
}

export async function getBalanceStaked(
  tmClient: Tendermint37Client,
  address: string
): Promise<Coin | null> {
  const client = await getClient(tmClient)
  return withChainTimeout(client.getBalanceStaked(address), 'getBalanceStaked')
}
