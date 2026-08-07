# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm workspace monorepo — run commands from the repo root, they fan out via `pnpm -r`:

- **Lint**: `pnpm lint` · **Type check**: `pnpm check` · **Test**: `pnpm test` · **Build**: `pnpm build`
- **Dev servers**: `pnpm dev:web` (Vite, http://localhost:5173) / `pnpm dev:api` (Fastify, http://localhost:4000, auto-restarts via `tsx watch`)
- Target a single workspace: `pnpm --filter @dexplorer/web <script>` / `pnpm --filter @dexplorer/api <script>` / `pnpm --filter @dexplorer/shared <script>`
- Single test file: `pnpm --filter @dexplorer/web test src/utils/helper.test.ts`

CI (`.github/workflows/ci.yml`) runs install → `pnpm -r lint/check/test/build` on every push/PR to `main`. Husky + lint-staged run `eslint --fix` and `prettier --write` on staged files at commit time (config lives at the repo root now, not per-app).

## Project Overview

Dexplorer is a Cosmos SDK blockchain explorer with two parts:

- **`apps/api`** (`@dexplorer/api`) — a Fastify + MongoDB backend that indexes a chain starting from genesis: a resumable backfill walks block-by-block via Tendermint RPC, then a live subscription tails new blocks. Validators/params/proposals are refreshed on a timer (low-churn, not per-block). Serves everything over a REST API.
- **`apps/web`** (`@dexplorer/web`) — the React/Vite frontend. It has **no direct chain connection** — it only talks to `apps/api` over HTTP/REST via TanStack Query. There is no more "connect to any RPC" flow; the backend indexes one chain, configured via its own `RPC_ADDRESS` env var.
- **`packages/shared`** (`@dexplorer/shared`) — code that must be identical on both sides: `decodeMsg`/`DecodeMsg` (the Cosmos SDK message-type registry, see below), denom-conversion utils, proposal-status labels, and the REST API's TypeScript response contracts (`src/types/api.ts`).

Data survives reloads (it's in MongoDB, not browser memory) and history goes back further than the last N in-memory blocks — this is the whole reason the backend exists; a prior frontend-only version held only a rolling window of recent blocks/txs in Redux.

### Tech Stack

- **apps/web**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query (all data fetching), React Router. No Redux/Zustand — removed once the RPC/streaming code they supported was deleted.
- **apps/api**: Fastify, native `mongodb` driver + Zod schemas (not Mongoose — matches the workspace's strict no-`any` policy), `@cosmjs/tendermint-rpc`/`@cosmjs/stargate` for chain queries, `xstream` for the live block subscription, `tsx` for dev/run (no compile step — see `apps/api/package.json`'s `build` script, which is a type-check, not a bundler).
- Both: i18next-free on the API side; frontend keeps Framer Motion, Sonner, i18next.

## Architecture

### `apps/api` — indexer + REST API

- `src/chain/` — `client.ts` (connect/validate a websocket `Tendermint37Client`), `abci.ts` (raw ABCI queries against staking/mint/gov/distribution/slashing modules), `query.ts` (`getBlock`/`getBlockResults`/`getNetworkStatus`/account & balance lookups), `subscribe.ts` (live block/tx subscriptions). This is a straight port of what a prior frontend-only version did client-side, now running server-side against one chain (`RPC_ADDRESS` env var) instead of a user-entered URL.
- `src/indexer/run.ts` is the orchestrator: connect → `ensureIndexes()` → seed `denomMetadata` → backfill `indexerState.lastIndexedHeight+1 .. head` (batched, see `backfill.ts`) → flip to live tail (`liveTail.ts`, gap-detection falls back to backfill) → start periodic validator/params/proposal refreshers. `checkpoint.ts` persists progress to the `indexerState` singleton doc after every batch, so a restart resumes instead of re-indexing from 0 — this is load-bearing, don't remove the checkpoint write from the batch loop.
- `src/indexer/blockIndexer.ts` is the core per-height unit: fetches block + `blockResults`, decodes every tx (`Tx.decode` + `decodeMsg` per message from `@dexplorer/shared`), extracts `senders` (`getSendersFromEvents`) and `ibcTransfer` (`indexer/ibcTransfer.ts`, ported from the old client-side IBC packet-event scanner) at index time, and upserts — both backfill and live-tail call this same function so the two paths can't produce divergent doc shapes.
- `src/routes/*.ts` — one file per resource, registered under `/api` in `server.ts`. `GET /api/accounts/:address` is the one deliberate exception to "everything is pre-indexed": balances/sequence are live current-state, proxied to the chain with a short in-memory TTL cache, since indexing balances for every address ever seen is out of scope.
- `src/db/schemas/*.schema.ts` — Zod schema + inferred type per Mongo collection (`blocks`, `transactions`, `validators`, `proposals`, `chainParams`, `denomMetadata`, `indexerState`). No dedicated `accounts` collection — "recent accounts" and "account tx history" are served directly off `transactions.senders` (indexed) rather than maintaining a derived collection.
- Env is Zod-validated and fails fast at startup (`src/config/env.ts`) — see `apps/api/.env.example` for the full list (`MONGODB_URI`, `RPC_ADDRESS`, `CHAIN_NAME`, refresh intervals, backfill batch/concurrency). Real secrets go in `apps/api/.env` (gitignored) — never in `.env.example`.

### `apps/web` — frontend

- `src/lib/apiClient.ts` is the single fetch choke point (`apiClient.get<T>('/path')`, base URL from `config.apiBaseUrl` / `VITE_API_BASE_URL`) — the RPC-layer equivalent of what `src/rpc/*` used to be.
- `src/hooks/useApiHealth.ts` polls `GET /api/health`; `App.tsx` gates the route tree on it (API unreachable → a message screen, not a "connect" form — there's nothing to configure client-side anymore).
- Data-fetching hooks (`useHomeData`, `useAccountData`, `useProposalData`, `useIBCTransfers`) are thin `useQuery` wrappers around REST endpoints, with `refetchInterval` used for "live" feel on list/dashboard views (Home, Blocks, Transactions) — there is no WebSocket/SSE push from the backend in this phase, polling is the deliberate simple choice.
- Detail pages (`BlockDetail`, `TransactionDetail`, `ValidatorDetail`, `ProposalDetail`, `AccountDetail`) fetch by route param via one-shot `useQuery`, no polling.

### Extending message-type decoding

`packages/shared/src/encoding/msg.ts` is a `typeUrl → decoder` map (`TYPE` object + `switch` in `decodeMsg`) — this is **the** extension point for supporting more Cosmos SDK message types. An unrecognized `typeUrl` decodes to `{ typeUrl, data: null }` rather than throwing, both in the indexer and anywhere else `decodeMsg` is called. When adding a new message type, add it here once — both `apps/api` (indexing) and `apps/web` (if it ever needs client-side decoding again) pick it up automatically since both import from `@dexplorer/shared`.

### Theming (apps/web)

`src/theme/ThemeProvider.tsx` is a React context (light/dark/system, persisted to `localStorage`) that writes CSS custom properties (`--color-*`) onto `document.documentElement` from the palette in `src/theme/colors.ts`. Components read theme via `useTheme()`.

### Path aliasing

`@/*` maps to `apps/web/src/*` (declared in `apps/web/tsconfig.app.json`, resolved via the `vite-tsconfig-paths` plugin) — only within `apps/web`. `apps/api` and `packages/shared` use plain relative imports; cross-workspace imports go through the `@dexplorer/shared` / `@dexplorer/api` / `@dexplorer/web` package names (pnpm workspace symlinks), never `@/...` across an app boundary.

## Coding Standards

### Core Principles

- **Immutability**: NEVER mutate objects. Return new state objects.
- **Type Safety**: strict `no-any` policy. Define proper interfaces. Prefer a typed cast (`as SpecificType`) over `any` when a library's inferred type is wrong or too loose.
- **Functional**: Use functional components and hooks.
- **Clean Code**: Functions < 50 lines, Files < 400 lines. Group by feature.

### Architecture & Pattern

- **Component Structure**: Group by feature (`components/AccountDetail`, `components/ProposalDetail`, `components/Home`, etc.). High cohesion.
- **Error Handling**: `try/catch` all async ops. Throw user-friendly errors.
- **New chain data needs**: add a route in `apps/api/src/routes/`, a type in `packages/shared/src/types/api.ts`, then a `useQuery` in the relevant `apps/web` hook — don't add a new direct chain call from the frontend.

### Workflow & Requirements

- **Git**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **TDD**: Write tests first (Red -> Green -> Refactor).
- **Testing Goal**: 80% coverage (Unit, Integration, E2E). `apps/api` route tests use `mongodb-memory-server` (see `apps/api/test/routes/`) — no live chain/Mongo needed to run them.
- **Verification**: ALWAYS run `pnpm lint` and `pnpm check` after every task completion to ensure code quality and type safety.
- **Security**: No hardcoded secrets — real credentials only in gitignored `.env` files, never `.env.example`.

## Known Issues (Fix Priority)

- **High**: Large components (`AccountDetail`, `ProposalDetail`, `Home`).
- **Medium**: `apps/web` polling intervals are per-hook constants rather than centrally tuned; revisit if API load becomes a concern.
- **Medium**: No push (WebSocket/SSE) channel from `apps/api` to the frontend yet — "live" views are polling-based. Noted as a deliberate Phase 1 scope boundary, not an oversight.
