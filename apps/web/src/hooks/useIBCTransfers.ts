import { useQuery } from '@tanstack/react-query'
import type { IBCTransferSummary, Paginated } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export const useIBCTransfers = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['ibc-transfers'],
    queryFn: () =>
      apiClient.get<Paginated<IBCTransferSummary>>(
        '/ibc-transfers?perPage=100'
      ),
    refetchInterval: 15_000,
  })

  const ibcTransfers = data?.data ?? []

  return {
    ibcTransfers,
    isLoading,
    hasTransfers: ibcTransfers.length > 0,
  }
}
