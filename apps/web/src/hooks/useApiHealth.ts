import { useQuery } from '@tanstack/react-query'
import type { HealthResponse } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export const useApiHealth = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<HealthResponse>('/health'),
    refetchInterval: 10_000,
    retry: false,
  })

  return {
    isHealthy: data?.status === 'ok',
    isLoading,
    health: data,
  }
}
