<div align="center">
  <h1 align="center">🚀 SVM Scan</h1>

  <p align="center">
    <strong>Steem Virtual Machine Explorer</strong>
    <br />
    An indexed block explorer for the Steem Virtual Machine chain — Cosmos SDK data and EVM data, one API, one UI
    <br />
    <br />
    <a href="#features">Features</a>
    ·
    <a href="https://blazeapps007.github.io/SVM-SCAN/">API Docs</a>
    ·
    <a href="https://github.com/blazeapps007/SVM-SCAN/issues">Report Bug</a>
    ·
    <a href="https://github.com/blazeapps007/SVM-SCAN/issues">Request Feature</a>
  </p>

  <p align="center">
    <a href="https://github.com/blazeapps007/SVM-SCAN/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/blazeapps007/SVM-SCAN.svg" alt="License" />
    </a>
    <a href="https://github.com/blazeapps007/SVM-SCAN/actions/workflows/ci.yml">
      <img src="https://github.com/blazeapps007/SVM-SCAN/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
    </a>
    <a href="https://github.com/blazeapps007/SVM-SCAN/actions/workflows/docs.yml">
      <img src="https://github.com/blazeapps007/SVM-SCAN/actions/workflows/docs.yml/badge.svg" alt="API Docs Status" />
    </a>
    <a href="https://github.com/blazeapps007/SVM-SCAN/stargazers">
      <img src="https://img.shields.io/github/stars/blazeapps007/SVM-SCAN" alt="Stars" />
    </a>
    <a href="https://github.com/blazeapps007/SVM-SCAN/network/members">
      <img src="https://img.shields.io/github/forks/blazeapps007/SVM-SCAN" alt="Forks" />
    </a>
  </p>
</div>

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Extending](#extending)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## 🌟 About

**SVM Scan** is a block explorer for the **Steem Virtual Machine** chain — a Cosmos SDK chain with an EVM execution layer bolted on. It's a pnpm monorepo with three parts:

- **`apps/api`** — a Fastify + MongoDB backend that indexes the chain from genesis (resumable backfill via Tendermint RPC, then a live tail for new blocks), decodes both Cosmos SDK messages and EVM transactions, and serves everything over a REST API.
- **`apps/web`** — the React/Vite frontend. It has no direct chain connection — it only talks to `apps/api` over HTTP.
- **`packages/shared`** — code that must be identical on both sides: the Cosmos SDK message-decoding registry, denom-conversion utils, and the REST API's TypeScript response contracts.

Because history lives in MongoDB rather than browser memory, data survives page reloads and isn't capped to the last N in-memory blocks.

## ✨ Features

**Cosmos SDK side**

- 📦 **Blocks & Transactions** — full history, indexed from genesis, with decoded messages (bank, staking, gov, slashing, distribution, IBC, and more — see [Extending](#extending))
- 👥 **Validators** — active set with real voting power, commission, uptime, and self-bond, denominated correctly against the chain's actual token decimals
- 🗳️ **Governance** — proposals with live vote tallies while voting is in progress, not just the final result
- 🌉 **IBC Transfers** — cross-chain transfers with amounts normalized to their base denom (correctly unwraps denom trace paths on returning vouchers)
- ⚙️ **Chain Parameters** — staking, mint, distribution, slashing, and gov module config
- 🔍 **Account pages** — native + IBC balances, staked balance, transaction history, and (if the account is also a validator) a link to its validator profile

**EVM side**

- 📜 **Decoded EVM transactions** — method name, interacted-with contract, and ERC-20/token transfers, decoded directly from the chain's own EVM JSON-RPC (no third-party indexer required)
- 🪙 **Token holdings** — ERC-20 balances and ERC-721/1155 NFT collections for any account, proxied from a Blockscout-compatible explorer
- 💧 **Liquidity Pools** — Uniswap V3-style pools are detected and indexed as they're created (token pair, fee tier, tick spacing), browsable in their own page

**Platform**

- 🗄️ **Persistent** — MongoDB-backed, survives reloads, goes back to genesis
- 🐳 **Single-container deploy** — one Docker image serves the API and the built frontend behind one port
- 🎨 **Modern UI** — dark/light themes, responsive layout

## 🛠️ Tech Stack

**Frontend (`apps/web`)** — React 18, TypeScript, Vite, Tailwind CSS, TanStack Query (all data fetching), React Router.

**Backend (`apps/api`)** — Fastify, native `mongodb` driver + Zod schemas (no Mongoose, no `any`), `@cosmjs/stargate` / `@cosmjs/tendermint-rpc` for chain queries, raw EVM JSON-RPC calls for the EVM side, `tsx` for running TypeScript directly (no build/bundle step).

**Shared (`packages/shared`)** — the Cosmos SDK message-decoding registry and denom utilities, imported by both apps so decoding logic can't drift between them.

**Tooling** — pnpm workspaces, Vitest + React Testing Library, ESLint + Prettier, GitHub Actions CI, Docker.

## 📋 Prerequisites

- **Node.js** v22 or higher
- **pnpm** v9 or higher (`corepack enable` will provision it)
- **MongoDB** — a connection string (local, Docker, or [Atlas](https://www.mongodb.com/cloud/atlas)) for the backend to index into
- **RPC access to the chain** — a Tendermint/CometBFT RPC endpoint (Cosmos side) and, optionally, an EVM JSON-RPC endpoint (for decoded EVM transaction detail) and a Blockscout-compatible API (for ERC-20/NFT holdings)

## 🚀 Installation

### Quick Start (local dev)

```bash
git clone https://github.com/blazeapps007/SVM-SCAN.git
cd SVM-SCAN

# Install dependencies (all three workspaces)
pnpm install

# Configure the backend
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — MONGODB_URI and RPC_ADDRESS are required;
# EVM_RPC_URL / EVM_EXPLORER_API_URL are optional (enable EVM tx detail
# and token-holdings features when set)

# Start the backend (indexes the chain, serves the REST API on :4000)
pnpm dev:api

# In a second terminal, start the frontend
pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173) — the frontend talks to the API at `http://localhost:4000/api` by default (configurable via `VITE_API_BASE_URL`, see `apps/web/.env.example`).

### Running Tests

```bash
pnpm test    # all workspaces
pnpm check   # type-check, all workspaces
pnpm lint    # all workspaces
```

CI (`.github/workflows/ci.yml`) runs all three on every push/PR to `main` — there's no local pre-commit hook, so run these yourself before pushing.

## ⚙️ Configuration

Real secrets go in gitignored `.env` files — never in `.env.example`.

**`apps/api/.env`** (backend — owns the chain connection):

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | Where indexed data is persisted |
| `RPC_ADDRESS` | ✅ | Tendermint/CometBFT RPC — backfilled from genesis, then live-tailed |
| `CHAIN_NAME` | | Optional display name |
| `PORT` | | API port (default `4000`) |
| `CORS_ORIGIN` | | Allowed frontend origin for local dev |
| `BACKFILL_BATCH_SIZE` / `BACKFILL_CONCURRENCY` | | Backfill tuning |
| `VALIDATOR_REFRESH_INTERVAL_MS` / `PARAMS_REFRESH_INTERVAL_MS` / `PROPOSAL_REFRESH_INTERVAL_MS` | | How often low-churn data is re-polled |
| `EVM_RPC_URL` | | This chain's own EVM JSON-RPC — enables decoded EVM transaction detail and liquidity-pool indexing |
| `EVM_EXPLORER_API_URL` | | A Blockscout-compatible explorer — enables ERC-20/NFT token holdings on account pages and a "view full trace" link |
| `STATIC_DIR` | | Set automatically by the Docker image; not for local dev |

**`apps/web`** — `VITE_API_BASE_URL` (default `http://localhost:4000/api` for local dev; the Docker image bakes in `/api`, a relative path, since the container serves both API and frontend from the same origin).

## 📖 Usage

1. **Start the backend** — it resumes from `indexerState.lastIndexedHeight` (0 on first run) up to the chain's current head, then switches to live-tailing new blocks. Watch the logs for backfill progress.
2. **Start the frontend**, open [http://localhost:5173](http://localhost:5173).
3. **Explore** — dashboard, blocks, transactions (Cosmos and EVM, with decoded detail), validators, governance, IBC transfers, liquidity pools, accounts. All data comes from MongoDB via the REST API, so reloading never loses anything.

## 🐳 Deployment

A single Dockerfile builds the frontend and runs the backend as one process serving both the REST API and the built frontend behind one port:

```bash
docker compose up -d --build
```

Serves on `http://localhost:85` by default (`apps/api/.env` supplies the real config via `env_file` — never baked into the image). Override the host port with `HOST_PORT=86 docker compose up -d --build` if you need a second instance alongside it.

Put your own reverse proxy (with your own TLS cert) in front of it — a reference nginx config living at [`deploy/nginx/`](./deploy/nginx) shows the pattern: terminate TLS, proxy to the container's port.

## 📁 Project Structure

```
SVM-SCAN/                         # pnpm workspace root
├── apps/
│   ├── api/                      # @dexplorer/api — Fastify + MongoDB indexer/REST backend
│   │   └── src/
│   │       ├── chain/            # Tendermint RPC + EVM JSON-RPC clients/queries
│   │       ├── db/                # Mongo connection, Zod schemas, indexes, seed data
│   │       ├── indexer/           # Backfill, live tail, checkpoint, refreshers, liquidity pools
│   │       ├── routes/            # REST endpoints (one file per resource)
│   │       └── plugins/           # Fastify plugins (CORS, error handling, static frontend serving)
│   └── web/                      # @dexplorer/web — the React/Vite frontend
│       └── src/
│           ├── components/        # UI components, grouped by feature
│           ├── hooks/             # Data-fetching hooks
│           ├── lib/               # apiClient
│           ├── pages/             # Route page components
│           ├── theme/             # Theme configuration
│           └── utils/             # Display/formatting helpers
├── packages/
│   └── shared/                   # @dexplorer/shared — message decoding registry, denom utils, API types
├── deploy/
│   └── nginx/                    # Reference reverse-proxy config
├── Dockerfile                    # Single-container build (API serves the built frontend)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## 🔌 Extending

**More Cosmos SDK message types**: `packages/shared/src/encoding/msg.ts` is a `typeUrl → decoder` map. Add a new case there and both `apps/api` (indexing) and `apps/web` pick it up automatically. An unrecognized type falls back to a best-effort generic decoder (raw protobuf fields, printable strings/addresses surfaced where possible) rather than showing nothing — useful for chain-specific custom modules you don't have a `.proto` for yet.

**New chain data**: add a route in `apps/api/src/routes/`, a type in `packages/shared/src/types/api.ts`, then a hook in `apps/web` — never add a direct chain call from the frontend.

## 🤝 Contributing

1. Fork the repository and clone your fork
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes — follow the existing code style, add tests, run `pnpm lint && pnpm check && pnpm test` before pushing
4. Commit and push, then open a pull request describing your changes and linking any related issues

Found a bug or have a feature request? Check [existing issues](https://github.com/blazeapps007/SVM-SCAN/issues) first, then open a new one with a clear description and reproduction steps.

## ❓ FAQ

**Q: Does this need a backend, or can it run frontend-only?**
A: It needs the backend (`apps/api`) — that's what indexes the chain into MongoDB and serves the REST API the frontend reads from. There's no more direct-RPC-from-the-browser mode.

**Q: What chain does this index?**
A: One chain, configured via `RPC_ADDRESS` in `apps/api/.env` — the Steem Virtual Machine chain by default, but any Cosmos SDK chain exposing standard Tendermint/CometBFT RPC will index and display correctly for the Cosmos-side data. EVM-side features (decoded transactions, token holdings, liquidity pools) additionally require the chain to have an EVM execution layer and JSON-RPC endpoint.

**Q: Can I point it at a different chain?**
A: Yes — set `RPC_ADDRESS` (and optionally `EVM_RPC_URL`/`EVM_EXPLORER_API_URL`) in `apps/api/.env` and let it backfill from genesis.

## 📄 License

This project is licensed under the **GNU General Public License v2.0** — see [`LICENSE`](./LICENSE) for the full text.

## 🙏 Acknowledgments

SVM Scan started as a fork of [arifintahu/dexplorer](https://github.com/arifintahu/dexplorer), a frontend-only Cosmos explorer — credit to its original author and contributors for that foundation. Since then it's diverged substantially: a persistent indexed backend, MongoDB storage, EVM transaction/token/liquidity-pool support, and a rebrand for the Steem Virtual Machine chain.

---

<div align="center">
  <p><a href="#top">⬆️ Back to Top</a></p>
</div>
