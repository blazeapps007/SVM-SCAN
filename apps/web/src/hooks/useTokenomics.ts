import { useQuery } from '@tanstack/react-query'
import type { TokenomicsResponse } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export const useTokenomics = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['tokenomics'],
    queryFn: () => apiClient.get<TokenomicsResponse>('/params/tokenomics'),
  })

  return { tokenomics: data ?? null, isLoading }
}
