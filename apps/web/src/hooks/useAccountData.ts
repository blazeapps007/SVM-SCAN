import { useQuery } from '@tanstack/react-query'
import type {
  AccountDetailResponse,
  Paginated,
  TransactionSummary,
} from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export const useAccountData = (address: string | undefined) => {
  const {
    data: account,
    isLoading: isAccountLoading,
    error: accountError,
  } = useQuery({
    queryKey: ['account', address],
    queryFn: () => apiClient.get<AccountDetailResponse>(`/accounts/${address}`),
    enabled: !!address,
  })

  const { data: txData, isLoading: isTxLoading } = useQuery({
    queryKey: ['account-transactions', address],
    queryFn: () =>
      apiClient.get<Paginated<TransactionSummary>>(
        `/accounts/${address}/transactions?page=0&perPage=10`
      ),
    enabled: !!address,
  })

  const transactions = txData?.data ?? []

  return {
    account: account ?? null,
    balances: account?.balances ?? [],
    stakedBalance: account?.stakedBalance ?? null,
    resolvedDenoms: account?.resolvedDenoms ?? {},
    transactions,
    totalCount: txData?.pagination.total ?? transactions.length,
    loading: isAccountLoading || isTxLoading,
    error: accountError ? (accountError as Error).message : null,
  }
}
