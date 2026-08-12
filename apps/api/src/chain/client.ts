import { Tendermint37Client, WebsocketClient } from '@cosmjs/tendermint-rpc'
import { StreamingSocket } from '@cosmjs/socket'
import { replaceHTTPtoWebsocket, isValidUrl } from './helpers'
import { withTimeout } from './withTimeout'

export async function validateConnection(rpcAddress: string): Promise<boolean> {
  if (!isValidUrl(rpcAddress)) {
    return false
  }

  return new Promise((resolve) => {
    const wsUrl = replaceHTTPtoWebsocket(rpcAddress)
    const path = wsUrl.endsWith('/') ? 'websocket' : '/websocket'
    const socket = new StreamingSocket(wsUrl + path, 3000)

    let resolved = false
    const safeResolve = (value: boolean) => {
      if (!resolved) {
        resolved = true
        resolve(value)
      }
    }

    socket.events.subscribe({
      error: () => {
        socket.disconnect()
        safeResolve(false)
      },
    })

    socket.connect()
    socket.connected
      .then(() => {
        socket.disconnect()
        safeResolve(true)
      })
      .catch(() => {
        socket.disconnect()
        safeResolve(false)
      })
  })
}

export interface ConnectedClient {
  tmClient: Tendermint37Client
  rpcAddress: string
}

// Tries each RPC address in order, returning the first one that connects
// successfully (and which address that was — callers shouldn't assume it's
// always RPC_ADDRESS once a backup has been used). Used at (re)connect time
// — e.g. on a fresh process start after a crash-restart — so a
// persistently-down primary node doesn't permanently block the indexer if a
// backup is configured and healthy.
export async function connectWithFailover(
  rpcAddresses: readonly string[]
): Promise<ConnectedClient> {
  let lastError: unknown

  for (const rpcAddress of rpcAddresses) {
    try {
      const tmClient = await connectWebsocketClient(rpcAddress)
      return { tmClient, rpcAddress }
    } catch (err) {
      lastError = err
      console.error(`Failed to connect to RPC node ${rpcAddress}:`, err)
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(
    `Failed to connect to any of ${rpcAddresses.length} RPC node(s): ${detail}`
  )
}

export async function connectWebsocketClient(
  rpcAddress: string
): Promise<Tendermint37Client> {
  if (!isValidUrl(rpcAddress)) {
    throw new Error('Invalid RPC URL format')
  }

  // The initial handshake + status() check isn't covered by the per-query
  // timeout in chain/query.ts (this runs before any of that exists) — a
  // hang here would otherwise block the whole process from ever starting.
  return withTimeout(connectWebsocketClientInner(rpcAddress), `connect(${rpcAddress})`)
}

async function connectWebsocketClientInner(
  rpcAddress: string
): Promise<Tendermint37Client> {
  return new Promise((resolve, reject) => {
    try {
      const wsUrl = replaceHTTPtoWebsocket(rpcAddress)
      const wsClient = new WebsocketClient(wsUrl, (err) => {
        reject(err)
      })
      Tendermint37Client.create(wsClient)
        .then(async (tmClient) => {
          if (!tmClient) {
            reject(new Error('cannot create tendermint client'))
            return
          }

          try {
            const status = await tmClient.status()
            if (!status) {
              reject(new Error('cannot get client status'))
              return
            }
            resolve(tmClient)
          } catch (err) {
            reject(err)
          }
        })
        .catch(reject)
    } catch (err) {
      reject(err)
    }
  })
}
