import { bech32 } from 'bech32'
import { readFileSync } from 'fs'

const address = 'steem107662cdhfe760n2lk9yhsv8fdve3pkzhlmtsvu'
const decoded = bech32.decode(address)
const bytes = Buffer.from(bech32.fromWords(decoded.words))
const evmAddress = '0x' + bytes.toString('hex')
console.log('bech32 payload bytes:', bytes.length)
console.log('derived EVM address:', evmAddress)

// Cross-check: query eth_getBalance for this derived address and compare
// against the cosmos-side asteem balance we already confirmed (6744432316496136504193)
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const get = (key) => {
  const line = envText.split('\n').find((l) => l.startsWith(key + '='))
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
}
const evmRpc = get('EVM_RPC_URL')

const res = await fetch(evmRpc, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [evmAddress, 'latest'], id: 1 }),
})
const json = await res.json()
console.log('eth_getBalance raw hex:', json.result)
console.log('eth_getBalance decimal:', BigInt(json.result).toString())
console.log('matches cosmos-side asteem balance (6744432316496136504193)?', BigInt(json.result).toString() === '6744432316496136504193')
