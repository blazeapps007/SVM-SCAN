import { useQuery } from '@tanstack/react-query'
import type {
  BridgeWithdrawal,
  BridgeWithdrawalStats,
  Paginated,
} from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export type BridgeWithdrawalStatusFilter =
  | 'all'
  | 'requested'
  | 'processed'
  | 'refunded'

const PER_PAGE = 25

export const useBridgeWithdrawals = (
  status: BridgeWithdrawalStatusFilter,
  page: number
) => {
  const { data, isLoading } = useQuery({
    queryKey: ['bridge-withdrawals', status, page],
    queryFn: () => {
      const statusParam = status === 'all' ? '' : `&status=${status}`
      return apiClient.get<Paginated<BridgeWithdrawal>>(
        `/bridge-withdrawals?page=${page}&perPage=${PER_PAGE}${statusParam}`
      )
    },
    refetchInterval: 15_000,
  })

  return {
    withdrawals: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    perPage: PER_PAGE,
    isLoading,
  }
}

export const useBridgeWithdrawalStats = () => {
  const { data } = useQuery({
    queryKey: ['bridge-withdrawals', 'stats'],
    queryFn: () =>
      apiClient.get<BridgeWithdrawalStats>('/bridge-withdrawals/stats'),
    refetchInterval: 15_000,
  })

  return data
}

export const useBridgeWithdrawal = (idOrBurnTxHash: string | undefined) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bridge-withdrawal', idOrBurnTxHash],
    queryFn: () =>
      apiClient.get<BridgeWithdrawal>(
        `/bridge-withdrawals/${idOrBurnTxHash}`
      ),
    enabled: Boolean(idOrBurnTxHash),
  })

  return {
    withdrawal: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  }
}
