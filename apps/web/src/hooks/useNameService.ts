import { useQuery } from '@tanstack/react-query'
import type { NameRecord, NameRegistration } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

export const useResolveName = (steemAccount: string | undefined) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['name-service', 'resolve', steemAccount],
    queryFn: () =>
      apiClient.get<NameRecord>(
        `/name-service/resolve/${encodeURIComponent(steemAccount ?? '')}`
      ),
    enabled: Boolean(steemAccount),
    retry: false,
  })

  return {
    record: data ?? null,
    isLoading,
    notFound: Boolean(error),
  }
}

export const useNamesByAddress = (address: string | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['name-service', 'by-address', address],
    queryFn: () =>
      apiClient.get<NameRecord[]>(
        `/name-service/by-address/${encodeURIComponent(address ?? '')}`
      ),
    enabled: Boolean(address),
  })

  return { records: data ?? [], isLoading }
}

export const useNameRegistrationsByAccount = (
  steemAccount: string | undefined
) => {
  const { data, isLoading } = useQuery({
    queryKey: ['name-service', 'registrations-by-account', steemAccount],
    queryFn: () =>
      apiClient.get<NameRegistration[]>(
        `/name-service/registrations-by-account/${encodeURIComponent(steemAccount ?? '')}`
      ),
    enabled: Boolean(steemAccount),
  })

  return { registrations: data ?? [], isLoading }
}

export const usePendingNameRegistrations = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['name-service', 'registrations', 'pending'],
    queryFn: () =>
      apiClient.get<NameRegistration[]>('/name-service/registrations/pending'),
    refetchInterval: 15_000,
  })

  return { registrations: data ?? [], isLoading }
}

export const useAwaitingNameRegistrations = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['name-service', 'registrations', 'awaiting'],
    queryFn: () =>
      apiClient.get<NameRegistration[]>(
        '/name-service/registrations/awaiting'
      ),
    refetchInterval: 15_000,
  })

  return { registrations: data ?? [], isLoading }
}

export const useNameRegistration = (id: string | undefined) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['name-service', 'registration', id],
    queryFn: () =>
      apiClient.get<NameRegistration>(`/name-service/registrations/${id}`),
    enabled: Boolean(id),
  })

  return {
    registration: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  }
}
