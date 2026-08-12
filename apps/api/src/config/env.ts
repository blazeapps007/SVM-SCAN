import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  RPC_ADDRESS: z.string().min(1, 'RPC_ADDRESS is required'),
  // Optional failover nodes, tried in order (RPC_ADDRESS first) whenever the
  // indexer (re)connects — e.g. after a crash-restart triggered by the
  // primary being down. Not live hot-swapping mid-request, just "next start
  // attempt tries a different node if this one won't connect."
  RPC_ADDRESS_BACKUP_1: z.string().optional(),
  RPC_ADDRESS_BACKUP_2: z.string().optional(),
  CHAIN_NAME: z.string().default(''),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  BACKFILL_BATCH_SIZE: z.coerce.number().int().positive().default(25),
  BACKFILL_CONCURRENCY: z.coerce.number().int().positive().default(5),
  VALIDATOR_REFRESH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
  PARAMS_REFRESH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(600000),
  PROPOSAL_REFRESH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
  // How long a single chain RPC query is allowed to hang before it's treated
  // as failed. The underlying WebSocket client retries the connection
  // forever on its own with backoff, but has no per-query timeout — without
  // this, a dropped connection means every in-flight (and new) request just
  // hangs indefinitely instead of failing, which looks like "the API is
  // unreachable" from outside even though the process is still running.
  CHAIN_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  // Optional: this chain's own EVM JSON-RPC endpoint (eth_getTransactionByHash
  // etc.) — primary source for decoding MsgEthereumTx transactions. Feature
  // is simply unavailable when unset.
  EVM_RPC_URL: z.string().optional(),
  // Optional: base URL of a Blockscout-compatible EVM explorer, used only to
  // build a "view full trace" deep link — not a data source.
  EVM_EXPLORER_API_URL: z.string().optional(),
  // Optional: this chain's LCD/REST (port 1317) base URL, used to poll the
  // custom steembridge module (Steem/SBD deposit oracle attestations) — no
  // generated proto or ABCI query path exists for this module, so it's
  // queried over REST instead. Feature is simply unavailable when unset.
  STEEMBRIDGE_LCD_URL: z.string().optional(),
  BRIDGE_DEPOSIT_REFRESH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  // Optional: absolute path to a built apps/web static bundle (index.html +
  // assets). When set, the API server also serves the frontend from this
  // directory (with an SPA fallback to index.html) so the whole app can run
  // as a single process behind one port — this is what the Docker image
  // uses. Left unset in normal local dev, where Vite serves the frontend.
  STATIC_DIR: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.data
