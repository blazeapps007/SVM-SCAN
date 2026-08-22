import { useQuery } from '@tanstack/react-query'
import type { Paginated, ProposalDetailResponse, ProposalVote } from '@dexplorer/shared'
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

// Live-proxied, not indexed (see the backend's fetchProposalVotes doc
// comment) — 503s once STEEMBRIDGE_LCD_URL isn't configured, and returns an
// empty page for a concluded proposal whose individual votes have since
// been pruned from the gov module's vote store, not necessarily "nobody
// voted." retry:false so a 503/404 doesn't spin forever.
export const useProposalVotes = (id: string | undefined, page: number) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['proposal-votes', id, page],
    queryFn: () =>
      apiClient.get<Paginated<ProposalVote>>(
        `/proposals/${id}/votes?page=${page}&perPage=25`
      ),
    enabled: !!id,
    retry: false,
  })

  return {
    votes: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    perPage: data?.pagination.perPage ?? 25,
    isLoading,
    isUnavailable: isError,
  }
}
