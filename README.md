<div align="center">
  <h1 align="center">🚀 SVM Scan</h1>

  <p align="center">
    <strong>Disposable Cosmos-based Blockchain Explorer</strong>
    <br />
    A lightweight, real-time blockchain explorer for Cosmos SDK chains
    <br />
    <br />
    <a href="#demo">View Demo</a>
    ·
    <a href="https://github.com/arifintahu/dexplorer/issues">Report Bug</a>
    ·
    <a href="https://github.com/arifintahu/dexplorer/issues">Request Feature</a>
  </p>

  <p align="center">
    <a href="https://github.com/arifintahu/dexplorer/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/arifintahu/dexplorer.svg" alt="License" />
    </a>
    <a href="https://github.com/arifintahu/dexplorer/actions/workflows/ci.yml">
      <img src="https://github.com/arifintahu/dexplorer/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
    </a>
    <a href="https://github.com/arifintahu/dexplorer/deployments/activity_log">
      <img src="https://vercelbadge.vercel.app/api/arifintahu/dexplorer" alt="Vercel Deploy" />
    </a>
    <a href="https://github.com/arifintahu/dexplorer/graphs/contributors">
      <img src="https://img.shields.io/github/contributors/arifintahu/dexplorer" alt="Contributors" />
    </a>
    <a href="https://github.com/arifintahu/dexplorer/stargazers">
      <img src="https://img.shields.io/github/stars/arifintahu/dexplorer" alt="Stars" />
    </a>
    <a href="https://github.com/arifintahu/dexplorer/network/members">
      <img src="https://img.shields.io/github/forks/arifintahu/dexplorer" alt="Forks" />
    </a>
  </p>
</div>

## 📋 Table of Contents

- [About](#about)
- [Demo](#demo)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)
- [Contributors](#contributors)

## 🌟 About

**SVM Scan** is a lightweight blockchain explorer for Cosmos-based blockchains. It's a pnpm monorepo with two parts: a **backend indexer** (`apps/api`) that walks a chain from genesis via Tendermint RPC and persists everything to MongoDB, and a **frontend** (`apps/web`) that reads from the backend's REST API — so data survives page reloads and history isn't limited to the last few in-memory blocks.

This makes it perfect for:

- 🔧 **Development**: Quick exploration during chain development
- 🧪 **Testing**: Instant setup for testnets and local chains
- 📊 **Monitoring**: Real-time blockchain data visualization
- 🗄️ **Historical data**: Full chain history persisted in MongoDB, not lost on reload

## 🎬 Demo

### Screenshots

#### 🏠 Home Dashboard

![Dexplorer Home Dashboard](./public/dexplorer2.jpeg)
_Real-time blockchain explorer dashboard showing chain statistics, latest blocks, and transactions_

#### 🔗 Connect to Blockchain

![Connect to Blockchain](./public/dexplorer1.jpeg)
_Simple connection interface to connect to any Cosmos SDK RPC endpoint_

### Live Demo

🌐 **[Try Dexplorer Live](https://dexplorer.arifintahu.com)**

_Connect to any Cosmos RPC endpoint and start exploring!_

## ✨ Features

- 🔗 **Universal Connectivity**: Connect to any Cosmos-based RPC endpoint
- 📊 **Real-time Dashboard**: Monitor chain activity with live updates via WebSocket
- 🔔 **Live Subscriptions**: Subscribe to latest blocks and transactions
- 🔍 **Powerful Search**: Find blocks, transactions, and accounts instantly
- 👥 **Validator Insights**: Browse active validators with real uptime, commission, and voting power
- 🗳️ **Governance**: Explore proposals and voting results
- ⚙️ **Chain Parameters**: View blockchain configuration and parameters
- 🌉 **IBC Transfers**: Track cross-chain transfers with converted amounts and channel data
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🎨 **Modern UI**: Clean, intuitive interface with dark/light themes and smooth animations
- ♿ **Accessible**: WCAG 2.1 AA compliant — keyboard navigable, screen-reader friendly, respects reduced motion
- 🌍 **i18n Ready**: Built on i18next, currently shipping English
- 🗄️ **Persistent**: Backend indexer + MongoDB — data survives reloads and goes back to genesis

## 🛠️ Tech Stack

### Frontend Core

- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework

### State & Data Management

- **TanStack Query** - Fetches from the backend REST API, powers polling for "live" views
- **React Router** - Client-side routing

### Backend (`apps/api`)

- **Fastify** - REST API server
- **MongoDB** (native driver + Zod schemas) - Persists blocks, transactions, validators, proposals, params
- **CosmJS** - Cosmos SDK JavaScript library (@cosmjs/stargate, @cosmjs/tendermint-rpc)
- **WebSocket RPC** - The indexer's connection to the chain (backfill + live tail)
- **Protobuf** - Message encoding/decoding, extensible via `packages/shared/src/encoding/msg.ts`

### UI Components & UX

- **Framer Motion** - Smooth animations and transitions
- **React Icons** - Modern icon set
- **Sonner** - Toast notifications

### Development & Quality Assurance

- **Vitest** - Blazing fast unit test framework
- **React Testing Library** - Component testing
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Husky & Lint-staged** - Git hooks for code quality
- **Vercel** - Deployment platform

## 📋 Prerequisites

Before running SVM Scan, ensure you have:

- **Node.js** (v22.0.0 or higher)
- **pnpm** (v8.0.0 or higher) - _Recommended package manager_
- **Git** - For cloning the repository
- **MongoDB** - A connection string (local, Docker, or [Atlas](https://www.mongodb.com/cloud/atlas)) for the backend to index into
- **A Cosmos SDK chain RPC endpoint** - Tendermint/CometBFT RPC (e.g. `https://rpc.cosmos.nodestake.org`) for the backend to index from

## 🚀 Installation

### Quick Start

```bash
# Clone the repository
git clone https://github.com/arifintahu/dexplorer.git
cd dexplorer

# Install dependencies (installs all three workspaces)
pnpm install

# Configure the backend: copy the template and fill in real values
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — set MONGODB_URI (a MongoDB/Atlas connection string)
# and RPC_ADDRESS (the chain's Tendermint/CometBFT RPC endpoint)

# Start the backend (indexes the chain into MongoDB, serves the REST API)
pnpm dev:api

# In a second terminal, start the frontend
pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173) — the frontend talks to the API at `http://localhost:4000` by default (proxied in dev via `apps/web/vite.config.ts`; configurable via `VITE_API_BASE_URL`, see `apps/web/.env.example`).

### Production Build

```bash
# Build every workspace
pnpm build

# Or a single one
pnpm --filter @dexplorer/web build
pnpm --filter @dexplorer/api build   # type-check only — apps/api runs via tsx, no bundling step
```

### Running Tests

```bash
pnpm test    # all workspaces
pnpm check   # type check, all workspaces
```

## ⚙️ Configuration

Both apps are configured via env files (never commit real secrets — `.env` is gitignored, `.env.example` holds placeholders only):

**`apps/api/.env`** (backend — owns the chain connection):

- `MONGODB_URI` — MongoDB connection string (indexed data lives here)
- `RPC_ADDRESS` — the chain's Tendermint/CometBFT RPC endpoint (backfilled from genesis, then live-tailed)
- `CHAIN_NAME` — optional display name
- `PORT` — API port (default `4000`)
- `BACKFILL_BATCH_SIZE` / `BACKFILL_CONCURRENCY` — backfill tuning
- `VALIDATOR_REFRESH_INTERVAL_MS` / `PARAMS_REFRESH_INTERVAL_MS` / `PROPOSAL_REFRESH_INTERVAL_MS` — how often low-churn data is re-polled

**`apps/web/.env`**:

- `VITE_API_BASE_URL` — where the frontend finds the backend (default `http://localhost:4000/api`)

## 📖 Usage

1. **Start the backend** (`pnpm dev:api`) — watch the logs; it backfills from `indexerState.lastIndexedHeight` (0 on first run) to the chain's current head, then switches to live-tailing new blocks.
2. **Start the frontend** (`pnpm dev:web`), open [http://localhost:5173](http://localhost:5173).
3. **Explore the blockchain** — dashboard overview, search for blocks/transactions/accounts, browse validators and governance proposals. All data comes from MongoDB via the REST API, so a reload doesn't lose anything.

## 📁 Project Structure

```
dexplorer/                      # pnpm workspace root
├── apps/
│   ├── api/                    # @dexplorer/api — Fastify + MongoDB indexer/REST backend
│   │   └── src/
│   │       ├── chain/          # Tendermint RPC client/queries/subscriptions
│   │       ├── db/             # Mongo connection, Zod schemas, indexes, seed data
│   │       ├── indexer/        # Backfill, live tail, checkpoint, refreshers
│   │       ├── routes/         # REST endpoints (one file per resource)
│   │       └── plugins/        # Fastify plugins (CORS, error handling)
│   └── web/                    # @dexplorer/web — the React/Vite frontend
│       ├── public/             # Static assets
│       └── src/
│           ├── components/     # UI Components (AccountDetail, Home, Layout, ProposalDetail, ui)
│           ├── hooks/          # Data-fetching hooks (useHomeData, useAccountData, etc.)
│           ├── lib/            # apiClient and other shared libs
│           ├── locales/        # i18n translation files
│           ├── pages/          # Route page components
│           ├── theme/          # Theme configuration (colors, providers)
│           ├── utils/          # Display/formatting helpers
│           └── main.tsx        # Application entry point
├── packages/
│   └── shared/                 # @dexplorer/shared — code identical on both sides:
│       └── src/                #   message-type decoding registry, denom utils, API response types
├── pnpm-workspace.yaml
└── eslint.config.js             # Single root config, scoped per workspace by file glob
```

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Development Workflow

1. **Fork the Repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/dexplorer.git
   ```

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Your Changes**
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

4. **Test Your Changes**

   ```bash
   pnpm test
   pnpm build
   ```

5. **Commit and Push**

   ```bash
   git commit -m 'Add amazing feature'
   git push origin feature/amazing-feature
   ```

6. **Create a Pull Request**
   - Describe your changes clearly
   - Link any related issues
   - Wait for review and feedback

### Code Style Guidelines

- Use **TypeScript** for all new code
- Follow **ESLint** and **Prettier** configurations
- Write **descriptive commit messages**
- Add **JSDoc comments** for complex functions
- Ensure **responsive design** for UI changes

### Reporting Issues

Found a bug? Have a feature request?

1. Check existing [issues](https://github.com/arifintahu/dexplorer/issues)
2. Create a new issue with detailed description
3. Include steps to reproduce (for bugs)
4. Add relevant labels

### Community Requests

- 💡 **Your Ideas**: [Suggest features](https://github.com/arifintahu/dexplorer/issues/new?template=feature_request.md)

## ❓ FAQ

### General Questions

**Q: What makes Dexplorer different from other blockchain explorers?**
A: Dexplorer is frontend-only, requiring no backend infrastructure. It connects directly to RPC endpoints, making it perfect for development and testing environments.

**Q: Can I use Dexplorer with my local blockchain?**
A: Yes! Simply point it to your local RPC endpoint (usually `http://localhost:26657`).

**Q: Is Dexplorer compatible with all Cosmos SDK chains?**
A: Dexplorer works with any Cosmos SDK chain that exposes standard RPC endpoints.

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Arifin Tahu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## 👥 Contributors

Thanks to all the amazing people who have contributed to this project:

<div align="center">
  <a href="https://github.com/arifintahu/dexplorer/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=arifintahu/dexplorer" alt="Contributors" />
  </a>
</div>

### Core Team

- **[@arifintahu](https://github.com/arifintahu)** - Creator & Maintainer

### Community Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Mayne-X">
        <img src="https://github.com/Mayne-X.png" width="80" height="80" alt="@Mayne-X" /><br />
        <sub><b>@Mayne-X</b></sub>
      </a>
    </td>
  </tr>
</table>

### How to Become a Contributor

1. Fork the repository
2. Make meaningful contributions
3. Submit pull requests
4. Help with issues and discussions
5. Spread the word about SVM Scan!

---

<div align="center">
  <p>
    <strong>Made with ❤️ for the Cosmos ecosystem</strong>
  </p>
  <p>
    <a href="#top">⬆️ Back to Top</a>
  </p>
</div>
