import { useQuery } from '@tanstack/react-query'
import type { ProposalDetailResponse } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export const useProposalData = (id: string | undefined) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['proposal', id],
    queryFn: () => apiClient.get<ProposalDetailResponse>(`/proposals/${id}`),
    enabled: !!id,
  })

  return {
    proposal: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  }
}
