import { Tendermint37Client, WebsocketClient } from '@cosmjs/tendermint-rpc'
import { StreamingSocket } from '@cosmjs/socket'
import { replaceHTTPtoWebsocket, isValidUrl } from './helpers'

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

export async function connectWebsocketClient(
  rpcAddress: string
): Promise<Tendermint37Client> {
  if (!isValidUrl(rpcAddress)) {
    throw new Error('Invalid RPC URL format')
  }

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
