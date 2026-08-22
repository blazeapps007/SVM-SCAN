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

export interface RawProposalVote {
  voter: string
  options: { option: string; weight: string }[]
}

// GET /cosmos/gov/v1/proposals/{id}/votes — unlike fetchProposalExtra, this
// is fetched live per-request rather than indexed (routes/proposals.ts
// proxies it directly): the gov module's vote store only holds *individual*
// votes while a proposal is still in its deposit/voting period — once a
// proposal concludes, the aggregate tally is retained (that's what
// proposalRefresh.ts indexes) but per-voter records are pruned, the same
// "concluded" boundary the tally-refresh logic already treats specially.
// So this can only reliably answer "who voted, and how" for a still-active
// proposal; an empty result for a concluded one means "no longer
// available," not necessarily "nobody voted." Returns an empty page (not a
// throw) on any non-OK response, since this is a best-effort supplementary
// view, not load-bearing.
export async function fetchProposalVotes(
  lcdUrl: string,
  proposalId: number,
  offset: number,
  limit: number
): Promise<{ votes: RawProposalVote[]; total: number }> {
  const url =
    `${lcdUrl}/cosmos/gov/v1/proposals/${proposalId}/votes` +
    `?pagination.offset=${offset}&pagination.limit=${limit}&pagination.count_total=true`
  const response = await withTimeout(fetch(url), 'gov:proposal-votes')
  if (!response.ok) return { votes: [], total: 0 }
  const json = (await response.json()) as {
    votes?: RawProposalVote[]
    pagination?: { total?: string }
  }
  return {
    votes: json.votes ?? [],
    total: Number(json.pagination?.total ?? 0),
  }
}
