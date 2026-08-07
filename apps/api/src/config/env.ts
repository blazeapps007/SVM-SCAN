import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  RPC_ADDRESS: z.string().min(1, 'RPC_ADDRESS is required'),
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
  // Optional: this chain's own EVM JSON-RPC endpoint (eth_getTransactionByHash
  // etc.) — primary source for decoding MsgEthereumTx transactions. Feature
  // is simply unavailable when unset.
  EVM_RPC_URL: z.string().optional(),
  // Optional: base URL of a Blockscout-compatible EVM explorer, used only to
  // build a "view full trace" deep link — not a data source.
  EVM_EXPLORER_API_URL: z.string().optional(),
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
