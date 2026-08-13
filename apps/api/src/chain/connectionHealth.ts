import { withTimeout, ChainQueryTimeoutError } from './withTimeout'

// A single timeout is normal (a slow node, a transient blip) and already
// handled by withTimeout. But the underlying WebSocket library
// (@cosmjs/socket's ReconnectingSocket — verified by reading its source)
// only ever reconnects in response to the native socket firing a `close`/
// `error` event. A connection that silently stops responding without ever
// closing (a proxy/NAT dropping an idle connection is the common real-world
// trigger) never fires that event, so it never reconnects — every query
// through it just keeps timing out, forever, until the process restarts and
// opens a fresh connection. There's no supported way to force that library
// to reconnect from here, so once consecutive timeouts make it clear the
// connection is dead rather than just slow, exit and let Docker's
// `restart: unless-stopped` bring the process back with a fresh one — same
// "crash and let the supervisor recover" pattern already used for indexer
// failures in index.ts.
const MAX_CONSECUTIVE_TIMEOUTS = 3
let consecutiveTimeouts = 0

// Use for anything that goes through the shared Tendermint WebSocket
// (tmClient / the QueryClient built on it) — NOT for evmRpc.ts or
// steembridgeLcd.ts, which are plain per-request HTTP fetches with no
// persistent connection to zombie in the same way.
export function withChainTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms?: number
): Promise<T> {
  return withTimeout(promise, label, ms).then(
    (value) => {
      consecutiveTimeouts = 0
      return value
    },
    (err: unknown) => {
      if (err instanceof ChainQueryTimeoutError) {
        consecutiveTimeouts += 1
        if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
          console.error(
            `${consecutiveTimeouts} consecutive chain query timeouts — connection likely dead, exiting for a clean restart`
          )
          process.exit(1)
        }
      }
      throw err
    }
  )
}
