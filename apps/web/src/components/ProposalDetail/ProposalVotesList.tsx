import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProposalDetailResponse, ProposalVoteOption } from '@dexplorer/shared'
import { voteOptionList } from '@dexplorer/shared'
import { useTheme } from '@/theme/ThemeProvider'
import type { ThemeColors } from '@/theme/colors'
import { useProposalVotes } from '@/hooks/useProposalData'
import { trimHash } from '@/utils/helper'

interface ProposalVotesListProps {
  proposal: ProposalDetailResponse
}

const CONCLUDED_STATUSES = new Set([
  'PROPOSAL_STATUS_PASSED',
  'PROPOSAL_STATUS_REJECTED',
  'PROPOSAL_STATUS_FAILED',
])

const getVoteOptionColor = (option: string, colors: ThemeColors): string => {
  const semanticColor = voteOptionList.find((o) => o.option === option)?.color
  switch (semanticColor) {
    case 'green':
      return colors.status.success
    case 'red':
      return colors.status.error
    case 'orange':
      return colors.status.warning
    default:
      return colors.text.tertiary
  }
}

const getVoteOptionLabel = (option: string): string =>
  voteOptionList.find((o) => o.option === option)?.label ??
  option.replace('VOTE_OPTION_', '')

const formatOptions = (options: ProposalVoteOption[], colors: ThemeColors) =>
  options.map((entry, index) => {
    const weightPercent = Math.round(Number(entry.weight) * 100)
    return (
      <span
        key={`${entry.option}-${index}`}
        className="reference-pill"
        style={{
          backgroundColor: `${getVoteOptionColor(entry.option, colors)}20`,
          color: getVoteOptionColor(entry.option, colors),
        }}
      >
        {getVoteOptionLabel(entry.option)}
        {options.length > 1 && ` (${weightPercent}%)`}
      </span>
    )
  })

export default function ProposalVotesList({
  proposal,
}: ProposalVotesListProps) {
  const { colors } = useTheme()
  const [page, setPage] = useState(0)
  const { votes, total, perPage, isLoading, isUnavailable } =
    useProposalVotes(proposal.id.toString(), page)

  return (
    <div className="panel-surface flex flex-col gap-3 rounded-[14px] px-6 py-5">
      <div className="flex items-center justify-between">
        <span
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Individual Votes{total > 0 && ` (${total})`}
        </span>
      </div>

      {isUnavailable ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          {CONCLUDED_STATUSES.has(proposal.status)
            ? 'Individual vote records are no longer available — the chain only retains them while a proposal is still in its deposit/voting period, not after it concludes.'
            : 'Individual vote records are unavailable right now.'}
        </p>
      ) : isLoading ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          Loading votes...
        </p>
      ) : votes.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          {CONCLUDED_STATUSES.has(proposal.status)
            ? 'No individual vote records available for this proposal.'
            : 'No votes cast yet.'}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {votes.map((vote) => (
              <div
                key={vote.voter}
                className="flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0 first:pt-0"
                style={{ borderColor: colors.border.primary }}
              >
                {vote.moniker ? (
                  <Link
                    to={`/validators/${vote.moniker}`}
                    className="text-[12.5px] font-semibold hover:opacity-70"
                    style={{ color: colors.primary }}
                    title={vote.voter}
                  >
                    {vote.moniker}
                  </Link>
                ) : (
                  <Link
                    to={`/accounts/${vote.voter}`}
                    className="font-mono text-[12.5px] hover:opacity-70"
                    style={{ color: colors.primary }}
                    title={vote.voter}
                  >
                    {trimHash(vote.voter, 12)}
                  </Link>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {formatOptions(vote.options, colors)}
                </div>
              </div>
            ))}
          </div>

          {total > perPage && (
            <div className="flex items-center justify-between pt-2">
              <span
                className="text-[11px]"
                style={{ color: colors.text.tertiary }}
              >
                Showing {page * perPage + 1}–
                {Math.min((page + 1) * perPage, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="rounded-[8px] border px-[13px] py-[7px] text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border.primary,
                    color: colors.text.tertiary,
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={(page + 1) * perPage >= total}
                  onClick={() => setPage(page + 1)}
                  className="rounded-[8px] border px-[13px] py-[7px] text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: `${colors.primary}18`,
                    borderColor: `${colors.primary}66`,
                    color: colors.primary,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
