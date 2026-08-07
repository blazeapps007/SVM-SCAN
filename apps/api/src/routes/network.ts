import type { FastifyInstance } from 'fastify'
import type { NetworkStatusResponse } from '@dexplorer/shared'
import type { AppContext } from '../server'
import { getNetworkStatus } from '../chain/query'

export function registerNetworkRoutes(
  app: FastifyInstance,
  { tmClient }: AppContext
): void {
  app.get('/network/status', async (): Promise<NetworkStatusResponse> => {
    const status = await getNetworkStatus(tmClient)
    return {
      chainId: status.chainId,
      blockHeight: status.blockHeight,
      catchingUp: status.catchingUp,
      peered: status.peered,
      blockInterval: parseFloat(status.blockInterval) || 0,
    }
  })
}
