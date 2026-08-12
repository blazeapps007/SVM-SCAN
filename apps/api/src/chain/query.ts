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

const clientCache = new WeakMap<Tendermint37Client, Promise<StargateClient>>()

async function getClient(
  tmClient: Tendermint37Client
): Promise<StargateClient> {
  if (!clientCache.has(tmClient)) {
    clientCache.set(
      tmClient,
      withTimeout(StargateClient.create(tmClient), 'StargateClient.create')
    )
  }
  return clientCache.get(tmClient)!
}

export async function getChainId(
  tmClient: Tendermint37Client
): Promise<string> {
  const client = await getClient(tmClient)
  return withTimeout(client.getChainId(), 'getChainId')
}

export async function getNetworkStatus(tmClient: Tendermint37Client): Promise<{
  chainId: string
  blockHeight: number
  catchingUp: boolean
  peered: number
  blockInterval: string
}> {
  const status = await withTimeout(tmClient.status(), 'status')
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
  return withTimeout(tmClient.validatorsAll(), 'validatorsAll')
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
  const [block, rawBlock] = await withTimeout(
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
  return withTimeout(tmClient.blockResults(height), `blockResults(${height})`)
}

export async function getTx(
  tmClient: Tendermint37Client,
  hash: string
): Promise<IndexedTx | null> {
  const client = await getClient(tmClient)
  return withTimeout(client.getTx(hash), 'getTx')
}

export async function getAccount(
  tmClient: Tendermint37Client,
  address: string
): Promise<Account | null> {
  const client = await getClient(tmClient)
  return withTimeout(client.getAccount(address), 'getAccount')
}

export async function getAllBalances(
  tmClient: Tendermint37Client,
  address: string
): Promise<readonly Coin[]> {
  const client = await getClient(tmClient)
  return withTimeout(client.getAllBalances(address), 'getAllBalances')
}

export async function getBalanceStaked(
  tmClient: Tendermint37Client,
  address: string
): Promise<Coin | null> {
  const client = await getClient(tmClient)
  return withTimeout(client.getBalanceStaked(address), 'getBalanceStaked')
}
