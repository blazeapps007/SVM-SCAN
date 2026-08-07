import { useQuery } from '@tanstack/react-query'
import type {
  BlockSummary,
  NetworkStatusResponse,
  Paginated,
  TransactionSummary,
  ValidatorStats,
} from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export interface HomeNetworkStatus {
  blockHeight: number
  catchingUp: boolean
  peers: number
  chainId: string
}

/**
 * Aggregates the data needed by the Home dashboard from the REST API.
 *
 * Semantics (new, REST-backed):
 * - isConnected: true once the network status endpoint has responded.
 * - totalTransactions: total indexed transaction count, from the
 *   `/transactions` pagination total (perPage=1, we only need the count).
 * - blockTime: derived client-side from the most recent and oldest blocks
 *   in a small recent window (same approach the old RPC-streamed version
 *   used, just sourced from the REST `/blocks` list instead of a live feed).
 */
export const useHomeData = () => {
  const networkStatusQuery = useQuery({
    queryKey: ['network-status', 'home'],
    queryFn: () => apiClient.get<NetworkStatusResponse>('/network/status'),
    refetchInterval: 10_000,
  })

  const blocksQuery = useQuery({
    queryKey: ['blocks', 'home'],
    queryFn: () => apiClient.get<Paginated<BlockSummary>>('/blocks?perPage=10'),
    refetchInterval: 6_000,
  })

  const transactionsCountQuery = useQuery({
    queryKey: ['transactions', 'count'],
    queryFn: () =>
      apiClient.get<Paginated<TransactionSummary>>('/transactions?perPage=1'),
    refetchInterval: 10_000,
  })

  const validatorStatsQuery = useQuery({
    queryKey: ['validators', 'stats'],
    queryFn: () => apiClient.get<ValidatorStats>('/validators/stats'),
    refetchInterval: 15_000,
  })

  const isConnected = Boolean(networkStatusQuery.data)

  const isLoading =
    networkStatusQuery.isLoading ||
    blocksQuery.isLoading ||
    transactionsCountQuery.isLoading ||
    validatorStatsQuery.isLoading

  const blocks = blocksQuery.data?.data ?? []
  const latestBlock = blocks.length > 0 ? blocks[0].height : null

  let blockTime = '--'
  if (blocks.length >= 2) {
    const recentBlock = blocks[0]
    const oldestBlock = blocks[blocks.length - 1]
    const heightDiff = recentBlock.height - oldestBlock.height
    const timeDiff =
      (new Date(recentBlock.time).getTime() -
        new Date(oldestBlock.time).getTime()) /
      1000

    if (heightDiff > 0 && timeDiff > 0) {
      blockTime = `${(timeDiff / heightDiff).toFixed(1)}s`
    }
  }

  const networkStatus: HomeNetworkStatus = {
    blockHeight: networkStatusQuery.data?.blockHeight ?? 0,
    catchingUp: networkStatusQuery.data?.catchingUp ?? false,
    peers: networkStatusQuery.data?.peered ?? 0,
    chainId: networkStatusQuery.data?.chainId ?? '',
  }

  return {
    isConnected,
    isLoading,
    latestBlock,
    totalTransactions: transactionsCountQuery.data?.pagination.total ?? 0,
    blockTime,
    totalActiveValidator: validatorStatsQuery.data?.activeCount ?? 0,
    networkStatus,
  }
}
