import { env } from '../config/env'

export class ChainQueryTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Chain query "${label}" timed out after ${ms}ms`)
    this.name = 'ChainQueryTimeoutError'
  }
}

// Races a chain query against a timeout. The underlying WebSocket client
// (see chain/client.ts) reconnects forever on its own with backoff, but a
// query already in flight when the connection drops just waits for a
// response that may never come — this is what turns "the chain node
// restarted" into "the whole API hangs." Without this, requests through
// tmClient during an outage never resolve at all.
export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms: number = env.CHAIN_QUERY_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ChainQueryTimeoutError(label, ms))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}
