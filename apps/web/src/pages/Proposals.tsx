import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiFileText, FiClock, FiCheckCircle } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { displayDate } from '@/utils/helper'
import type {
  Paginated,
  ProposalStats,
  ProposalSummary,
  proposalStatus,
} from '@dexplorer/shared'
import { proposalStatusList } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import StatCard from '@/components/Home/StatCard'

// The API stores proposal status as the raw Cosmos SDK enum name, e.g.
// "PROPOSAL_STATUS_VOTING_PERIOD". Normalize it to match proposalStatusList's
// human-readable "VOTING PERIOD" style labels.
const getStatusInfo = (status: string): proposalStatus | undefined => {
  const normalized = status.replace('PROPOSAL_STATUS_', '').replace(/_/g, ' ')
  return proposalStatusList.find(
    (item) => item.status.toUpperCase() === normalized.toUpperCase()
  )
}

const Proposals: React.FC = () => {
  const { colors } = useTheme()
  const [page, setPage] = useState(0)
  const perPage = 10

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', page, perPage],
    queryFn: () =>
      apiClient.get<Paginated<ProposalSummary>>(
        `/proposals?page=${page}&perPage=${perPage}`
      ),
  })

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['proposals', 'stats'],
    queryFn: () => apiClient.get<ProposalStats>('/proposals/stats'),
  })

  const proposals = data?.data ?? []
  const total = data?.pagination.total ?? 0

  const getStatusColor = (status: proposalStatus | undefined) => {
    if (!status) return colors.text.tertiary

    switch (status.status.toLowerCase()) {
      case 'passed':
        return colors.status.success
      case 'rejected':
      case 'failed':
        return colors.status.error
      case 'voting period':
        return colors.status.info
      case 'deposit period':
        return colors.status.warning
      default:
        return colors.text.tertiary
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Proposals"
          value={stats?.total ?? 0}
          icon={FiFileText}
          isLoading={isStatsLoading}
        />
        <StatCard
          title="Active Voting"
          value={stats?.activeVoting ?? 0}
          icon={FiClock}
          iconColor={colors.status.info}
          isLoading={isStatsLoading}
        />
        <StatCard
          title="Passed"
          value={stats?.passed ?? 0}
          icon={FiCheckCircle}
          iconColor={colors.status.success}
          isLoading={isStatsLoading}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-[14px]">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="panel-surface flex flex-col gap-[15px] rounded-[14px] px-[22px] py-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-10 animate-pulse rounded"
                  style={{ backgroundColor: colors.border.primary }}
                />
                <div
                  className="h-4 flex-1 animate-pulse rounded"
                  style={{ backgroundColor: colors.border.primary }}
                />
                <div
                  className="h-5 w-16 animate-pulse rounded-full"
                  style={{ backgroundColor: colors.border.primary }}
                />
              </div>
              <div
                className="h-[9px] w-full animate-pulse rounded-[5px]"
                style={{ backgroundColor: colors.border.primary }}
              />
            </div>
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="panel-surface rounded-[14px] py-12 text-center">
          <FiFileText
            className="mx-auto mb-4 h-12 w-12 opacity-50"
            style={{ color: colors.text.tertiary }}
          />
          <p style={{ color: colors.text.secondary }}>No proposals available</p>
          <p className="mt-1 text-sm" style={{ color: colors.text.tertiary }}>
            Governance proposals will appear here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {proposals.map((proposal) => {
            const statusInfo = getStatusInfo(proposal.status)
            const statusColor = getStatusColor(statusInfo)
            const votingStart = proposal.votingStartTime
              ? displayDate(proposal.votingStartTime)
              : ''
            const votingEnd = proposal.votingEndTime
              ? displayDate(proposal.votingEndTime)
              : ''

            return (
              <Link
                key={proposal.id}
                to={`/proposals/${proposal.id}`}
                className="reference-table-row panel-surface flex cursor-pointer flex-col gap-[15px] rounded-[14px] px-[22px] py-5"
              >
                <div className="flex items-start gap-[14px]">
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: colors.text.tertiary }}
                  >
                    #{proposal.id}
                  </span>
                  <span
                    className="flex-1 text-[15px] font-semibold leading-[1.35]"
                    style={{ color: colors.text.primary }}
                  >
                    {proposal.title}
                  </span>
                  <span
                    className="reference-pill capitalize"
                    style={{
                      backgroundColor: `${statusColor}20`,
                      color: statusColor,
                    }}
                  >
                    {statusInfo?.status.toLowerCase() || 'unknown'}
                  </span>
                </div>

                {(votingStart || votingEnd) && (
                  <span
                    className="text-xs"
                    style={{ color: colors.text.tertiary }}
                  >
                    {votingStart && votingEnd
                      ? `Voting ${votingStart} → ${votingEnd}`
                      : votingEnd
                        ? `Voting ends ${votingEnd}`
                        : `Voting starts ${votingStart}`}
                  </span>
                )}
              </Link>
            )
          })}

          <div className="panel-surface flex items-center justify-between rounded-[14px] px-5 py-[14px]">
            <span className="text-xs" style={{ color: colors.text.tertiary }}>
              Showing {page * perPage + 1}–
              {Math.min((page + 1) * perPage, total)} of {total} proposals
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
        </div>
      )}
    </div>
  )
}

export default Proposals
