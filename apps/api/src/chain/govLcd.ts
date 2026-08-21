// Minimal LCD/REST client for the chain's standard Cosmos SDK gov v1 module
// — not steembridge-specific, but exposed on the same LCD as
// STEEMBRIDGE_LCD_URL. Used only to backfill proposal fields that come back
// null/empty from the ABCI path (chain/abci.ts's queryProposals, decoded via
// cosmjs-types): submit/deposit-end/voting-start/voting-end all decode as
// undefined there on this chain even though the chain clearly has real
// values for them (verified live via this same LCD endpoint) — root cause
// unconfirmed (a cosmjs-types/chain proto version mismatch is the leading
// suspect), but LCD/REST (grpc-gateway) always reflects the chain's actual
// current proto via reflection, so it isn't affected by whatever's
// confusing the fixed-schema ABCI decode.

import { withTimeout } from './withTimeout'

export interface RawProposalExtra {
  submit_time?: string
  deposit_end_time?: string
  voting_start_time?: string
  voting_end_time?: string
  expedited?: boolean
  failed_reason?: string
}

// GET /cosmos/gov/v1/proposals/{id} — returns null (not a throw) on any
// non-OK response, since this is purely a best-effort enrichment on top of
// the ABCI-sourced proposal data, not load-bearing for it.
export async function fetchProposalExtra(
  lcdUrl: string,
  proposalId: number
): Promise<RawProposalExtra | null> {
  const url = `${lcdUrl}/cosmos/gov/v1/proposals/${proposalId}`
  const response = await withTimeout(fetch(url), 'gov:proposal-extra')
  if (!response.ok) return null
  const json = (await response.json()) as { proposal?: RawProposalExtra }
  return json.proposal ?? null
}
