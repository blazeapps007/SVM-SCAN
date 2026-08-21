import { useQuery } from '@tanstack/react-query'
import type { ExchangeRate } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

// Rates only change once per oracle vote period, but polling keeps the
// Parameters page feeling "live" the same way other dashboard views do.
export const useOracleExchangeRates = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['oracle', 'exchange-rates'],
    queryFn: () => apiClient.get<ExchangeRate[]>('/oracle/exchange-rates'),
    refetchInterval: 30_000,
    retry: false,
  })

  return {
    rates: data ?? [],
    isLoading,
    unavailable: Boolean(error),
  }
}
