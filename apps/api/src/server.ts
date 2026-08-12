import Fastify, { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { env } from './config/env'
import { registerCors } from './plugins/cors'
import { registerErrorHandler } from './plugins/errorHandler'
import { registerHealthRoutes } from './routes/health'
import { registerNetworkRoutes } from './routes/network'
import { registerBlockRoutes } from './routes/blocks'
import { registerTransactionRoutes } from './routes/transactions'
import { registerValidatorRoutes } from './routes/validators'
import { registerProposalRoutes } from './routes/proposals'
import { registerAccountRoutes } from './routes/accounts'
import { registerIBCTransferRoutes } from './routes/ibcTransfers'
import { registerParamsRoutes } from './routes/params'
import { registerDenomRoutes } from './routes/denoms'
import { registerEvmRoutes } from './routes/evm'
import { registerLiquidityPoolRoutes } from './routes/liquidityPools'
import { registerBridgeDepositRoutes } from './routes/bridgeDeposits'
import { registerBridgeWithdrawalRoutes } from './routes/bridgeWithdrawals'

export interface AppContext {
  db: Db
  tmClient: Tendermint37Client
}

export async function buildServer(
  context: AppContext
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true })

  await registerCors(app)
  registerErrorHandler(app)

  await app.register(
    async (api) => {
      registerHealthRoutes(api, context)
      registerNetworkRoutes(api, context)
      registerBlockRoutes(api, context)
      registerTransactionRoutes(api, context)
      registerValidatorRoutes(api, context)
      registerProposalRoutes(api, context)
      registerAccountRoutes(api, context)
      registerIBCTransferRoutes(api, context)
      registerParamsRoutes(api, context)
      registerDenomRoutes(api, context)
      registerEvmRoutes(api)
      registerLiquidityPoolRoutes(api, context)
      registerBridgeDepositRoutes(api, context)
      registerBridgeWithdrawalRoutes(api, context)
    },
    { prefix: '/api' }
  )

  // When STATIC_DIR is set (the Docker image), serve the built frontend
  // from the same process/port instead of relying on a separate web server.
  // Local dev leaves this unset — Vite serves the frontend on its own port.
  if (env.STATIC_DIR) {
    await app.register(fastifyStatic, {
      root: env.STATIC_DIR,
      index: 'index.html',
    })
  }

  // Exactly one not-found handler for the whole instance (Fastify errors if
  // you try to set more than one) — /api/* always gets a plain JSON 404;
  // anything else falls back to the SPA's index.html when STATIC_DIR is set,
  // so client-side routes like /blocks/123 work on a full page load.
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith('/api') || !env.STATIC_DIR) {
      reply.status(404).send({ error: 'Not found' })
      return
    }
    reply.sendFile('index.html')
  })

  return app
}
