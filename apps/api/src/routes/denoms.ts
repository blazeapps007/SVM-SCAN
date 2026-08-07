import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../server'
import { getDenomMetadata, listDenomMetadata } from '../indexer/denomRegistry'

export function registerDenomRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  app.get('/denoms', async () => {
    return listDenomMetadata(db)
  })

  app.get<{ Params: { denom: string } }>('/denoms/:denom', async (request) => {
    return getDenomMetadata(db, request.params.denom)
  })
}
