import { useQuery } from '@tanstack/react-query'
import type { BridgeDeposit, BridgeDepositStats, Paginated } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export type BridgeDepositStatusFilter =
  | 'all'
  | 'pending'
  | 'minted'
  | 'unclaimable'

const PER_PAGE = 25

export const useBridgeDeposits = (
  status: BridgeDepositStatusFilter,
  page: number
) => {
  const { data, isLoading } = useQuery({
    queryKey: ['bridge-deposits', status, page],
    queryFn: () => {
      const statusParam = status === 'all' ? '' : `&status=${status}`
      return apiClient.get<Paginated<BridgeDeposit>>(
        `/bridge-deposits?page=${page}&perPage=${PER_PAGE}${statusParam}`
      )
    },
    refetchInterval: 15_000,
  })

  return {
    deposits: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    perPage: PER_PAGE,
    isLoading,
  }
}

export const useBridgeDepositStats = () => {
  const { data } = useQuery({
    queryKey: ['bridge-deposits', 'stats'],
    queryFn: () => apiClient.get<BridgeDepositStats>('/bridge-deposits/stats'),
    refetchInterval: 15_000,
  })

  return data
}

export const useBridgeDeposit = (idOrTxid: string | undefined) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bridge-deposit', idOrTxid],
    queryFn: () => apiClient.get<BridgeDeposit>(`/bridge-deposits/${idOrTxid}`),
    enabled: Boolean(idOrTxid),
  })

  return {
    deposit: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  }
}
