// Minimal Ethereum JSON-RPC client + ABI decoding, scoped to exactly what
// the EVM transaction detail panel needs. Deliberately not a general-purpose
// ethers/viem replacement — just eth_getTransactionBy Hash/Receipt/Code/Call
// plus decoding for the two universally standardized event signatures we
// care about (ERC-20 Transfer, WETH-style Deposit) and the ERC-20
// name/symbol/decimals read functions. No ABI database, no 3rd-party
// dependency — everything decoded here is a standardized, well-known
// selector/topic, not chain- or contract-specific guesswork.

import { withTimeout } from './withTimeout'

interface EthLog {
  address: string
  topics: string[]
  data: string
}

interface EthTransaction {
  hash: string
  from: string
  to: string | null
  value: string
  input: string
}

interface EthTransactionReceipt {
  status: string
  gasUsed: string
  logs: EthLog[]
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<T> {
  // Plain fetch() has no default timeout in Node — without this, a hung EVM
  // node would leave every request through here waiting forever, the same
  // class of bug as the Cosmos-side tmClient calls (see withTimeout.ts).
  const response = await withTimeout(
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    }),
    `evm:${method}`
  )
  const json = (await response.json()) as {
    result?: T
    error?: { message: string }
  }
  if (json.error) throw new Error(json.error.message)
  if (json.result === undefined) throw new Error(`Empty result for ${method}`)
  return json.result
}

export async function getEthTransaction(
  rpcUrl: string,
  hash: string
): Promise<EthTransaction | null> {
  return rpcCall<EthTransaction | null>(rpcUrl, 'eth_getTransactionByHash', [
    hash,
  ])
}

export async function getEthTransactionReceipt(
  rpcUrl: string,
  hash: string
): Promise<EthTransactionReceipt | null> {
  return rpcCall<EthTransactionReceipt | null>(
    rpcUrl,
    'eth_getTransactionReceipt',
    [hash]
  )
}

export async function getEthCode(
  rpcUrl: string,
  address: string
): Promise<string> {
  return rpcCall<string>(rpcUrl, 'eth_getCode', [address, 'latest'])
}

async function ethCall(
  rpcUrl: string,
  to: string,
  data: string
): Promise<string | null> {
  try {
    return await rpcCall<string>(rpcUrl, 'eth_call', [{ to, data }, 'latest'])
  } catch {
    return null
  }
}

function decodeAbiUint(hexData: string | null): string | null {
  if (!hexData) return null
  const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData
  if (!data) return null
  try {
    return BigInt('0x' + data.slice(-64)).toString()
  } catch {
    return null
  }
}

function decodeAbiString(hexData: string | null): string | null {
  if (!hexData) return null
  const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData
  if (data.length < 128) return null
  try {
    const offset = parseInt(data.slice(0, 64), 16) * 2
    const length = parseInt(data.slice(offset, offset + 64), 16)
    const strHex = data.slice(offset + 64, offset + 64 + length * 2)
    return Buffer.from(strHex, 'hex').toString('utf8')
  } catch {
    return null
  }
}

const ERC20_SELECTORS = {
  name: '0x06fdde03',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
}

export interface Erc20Metadata {
  name: string | null
  symbol: string | null
  decimals: string | null
}

export async function getErc20Metadata(
  rpcUrl: string,
  tokenAddress: string
): Promise<Erc20Metadata> {
  const [name, symbol, decimals] = await Promise.all([
    ethCall(rpcUrl, tokenAddress, ERC20_SELECTORS.name),
    ethCall(rpcUrl, tokenAddress, ERC20_SELECTORS.symbol),
    ethCall(rpcUrl, tokenAddress, ERC20_SELECTORS.decimals),
  ])
  return {
    name: decodeAbiString(name),
    symbol: decodeAbiString(symbol),
    decimals: decodeAbiUint(decimals),
  }
}

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
// keccak256("Deposit(address,uint256)") — WETH9-style wrapped-native-token
// mint-on-deposit event. Confirmed against a live WSTEEM (wrapped STEEM)
// deposit log, not guessed from memory.
const DEPOSIT_TOPIC =
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export interface DecodedTokenTransfer {
  type: 'token_transfer' | 'token_minting'
  tokenAddress: string
  from: string
  to: string
  amount: string
}

function topicToAddress(topic: string): string {
  return '0x' + topic.slice(-40)
}

export function decodeTokenTransferLogs(
  logs: EthLog[]
): DecodedTokenTransfer[] {
  const transfers: DecodedTokenTransfer[] = []

  for (const log of logs) {
    const topic0 = log.topics[0]?.toLowerCase()

    if (topic0 === TRANSFER_TOPIC && log.topics.length >= 3) {
      transfers.push({
        type: 'token_transfer',
        tokenAddress: log.address,
        from: topicToAddress(log.topics[1]),
        to: topicToAddress(log.topics[2]),
        amount: BigInt(log.data || '0x0').toString(),
      })
    } else if (topic0 === DEPOSIT_TOPIC && log.topics.length >= 2) {
      // Deposit(address indexed dst, uint256 wad) — treat as a mint from
      // the zero address, matching how ERC-20 mints are conventionally
      // represented.
      transfers.push({
        type: 'token_minting',
        tokenAddress: log.address,
        from: ZERO_ADDRESS,
        to: topicToAddress(log.topics[1]),
        amount: BigInt(log.data || '0x0').toString(),
      })
    }
  }

  return transfers
}

// PoolCreated(address indexed token0, address indexed token1, uint24
// indexed fee, int24 tickSpacing, address pool) — Uniswap V3-style factory
// event. Confirmed against a live pool creation on this chain (decoded
// word-by-word against known token addresses/pool address from the actual
// tx), not assumed from spec.
const POOL_CREATED_TOPIC =
  '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118'

export interface DecodedPoolCreated {
  factoryAddress: string
  token0: string
  token1: string
  fee: string
  tickSpacing: string
  poolAddress: string
}

export function decodePoolCreatedLogs(logs: EthLog[]): DecodedPoolCreated[] {
  const pools: DecodedPoolCreated[] = []

  for (const log of logs) {
    if (log.topics[0]?.toLowerCase() !== POOL_CREATED_TOPIC) continue
    if (log.topics.length < 4) continue

    const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data
    if (data.length < 128) continue

    const tickSpacingWord = data.slice(0, 64)
    const poolAddressWord = data.slice(64, 128)

    pools.push({
      factoryAddress: log.address,
      token0: topicToAddress(log.topics[1]),
      token1: topicToAddress(log.topics[2]),
      fee: BigInt(log.topics[3]).toString(),
      tickSpacing: BigInt('0x' + tickSpacingWord).toString(),
      poolAddress: '0x' + poolAddressWord.slice(-40),
    })
  }

  return pools
}

// A tiny, deliberately small set of very well-known 4-byte function
// selectors — not a general ABI/signature database, just enough to label
// common cases instead of showing a raw hex selector. Falls back to the raw
// selector (still fully honest/derivable from the tx itself) when unknown.
const KNOWN_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x095ea7b3': 'approve',
  '0x23b872dd': 'transferFrom',
  '0x414bf389': 'exactInputSingle',
  '0xdb3e2198': 'exactOutputSingle',
  '0xd0e30db0': 'deposit',
  '0x2e1a7d4d': 'withdraw',
}

export function resolveMethodLabel(input: string): string | null {
  if (!input || input === '0x') return null
  const selector = input.slice(0, 10).toLowerCase()
  return KNOWN_SELECTORS[selector] || selector
}

export type { EthTransaction, EthTransactionReceipt, EthLog }
