import type { FastifyInstance } from 'fastify'
import type {
  BridgeParams,
  ChainParamsResponse,
  OracleParams,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
import {
  CHAIN_PARAMS_COLLECTION,
  ChainParamsDoc,
} from '../db/schemas/chainParams.schema'

export function registerParamsRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  app.get('/params', async (): Promise<ChainParamsResponse> => {
    const docs = await db
      .collection<ChainParamsDoc>(CHAIN_PARAMS_COLLECTION)
      .find()
      .toArray()

    const byId = new Map(
      docs.map((doc) => [
        doc._id,
        doc.params as Record<string, unknown> | undefined,
      ])
    )

    return {
      staking: byId.get('staking') ?? null,
      mint: byId.get('mint') ?? null,
      distribution: byId.get('distribution') ?? null,
      slashing: byId.get('slashing') ?? null,
      gov: {
        votingParams: byId.get('govVoting') ?? null,
        depositParams: byId.get('govDeposit') ?? null,
        tallyParams: byId.get('govTally') ?? null,
      },
      bridge: (byId.get('bridge') as BridgeParams | undefined) ?? null,
      oracle: (byId.get('oracle') as OracleParams | undefined) ?? null,
    }
  })
}
