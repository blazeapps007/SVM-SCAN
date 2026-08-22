import { useQuery } from '@tanstack/react-query'
import type {
  ValidatorAttestation,
  ValidatorOracleSubmission,
} from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'

// Each of these is its own request (not folded into the main validator
// detail fetch) so the heavier attestation/oracle history can load
// independently without slowing down the page's primary info.

export const useValidatorAttestations = (identity: string | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['validator-attestations', identity],
    queryFn: () =>
      apiClient.get<ValidatorAttestation[]>(
        `/validators/${encodeURIComponent(identity ?? '')}/attestations`
      ),
    enabled: !!identity,
  })

  return { attestations: data ?? [], isLoading }
}

export const useValidatorOracleSubmissions = (identity: string | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['validator-oracle-submissions', identity],
    queryFn: () =>
      apiClient.get<ValidatorOracleSubmission[]>(
        `/validators/${encodeURIComponent(identity ?? '')}/oracle-submissions`
      ),
    enabled: !!identity,
  })

  return { submissions: data ?? [], isLoading }
}
