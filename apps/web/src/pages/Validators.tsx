import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiUsers, FiShield, FiPercent } from 'react-icons/fi'
import type {
  Paginated,
  ValidatorStats,
  ValidatorSummary,
} from '@dexplorer/shared'
import { formatAmount, getConvertedAmount } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { convertRateToPercent } from '@/utils/helper'
import { useTheme } from '@/theme/ThemeProvider'
import ValidatorIcon from '@/components/ValidatorIcon'
import StatCard from '@/components/Home/StatCard'

const PER_PAGE = 10

const formatVotingPower = (tokens: string, bondDenom: string): string => {
  if (!bondDenom) return tokens
  const { converted, base } = getConvertedAmount(tokens, bondDenom)
  return `${formatAmount(converted)} ${base.toUpperCase()}`
}

const Validators: React.FC = () => {
  const { colors } = useTheme()
  const [page, setPage] = useState(0)

  const validatorsQuery = useQuery({
    queryKey: ['validators', 'all', page],
    queryFn: () =>
      apiClient.get<Paginated<ValidatorSummary>>(
        `/validators?page=${page}&perPage=${PER_PAGE}`
      ),
    refetchInterval: 15_000,
  })

  const statsQuery = useQuery({
    queryKey: ['validators', 'stats'],
    queryFn: () => apiClient.get<ValidatorStats>('/validators/stats'),
    refetchInterval: 15_000,
  })

  const data = validatorsQuery.data?.data ?? []
  const totalListed = validatorsQuery.data?.pagination.total ?? 0
  const activeCount = statsQuery.data?.activeCount ?? 0
  const totalValidator = statsQuery.data?.totalCount ?? 0
  const avgCommission = `${(statsQuery.data?.avgCommission ?? 0).toFixed(1)}%`

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Active Validators"
          value={activeCount}
          icon={FiShield}
          subtitle="Currently bonded"
          index={0}
        />
        <StatCard
          title="Total Validators"
          value={totalValidator}
          icon={FiUsers}
          subtitle="Registered on chain"
          index={1}
        />
        <StatCard
          title="Avg Commission"
          value={avgCommission}
          icon={FiPercent}
          subtitle="Across active set"
          index={2}
        />
      </div>

      <div className="reference-table-shell">
        <div
          className="hidden gap-3 border-b px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] md:grid md:grid-cols-[44px_1.6fr_1.1fr_100px_84px]"
          style={{
            borderColor: colors.border.primary,
            color: colors.text.tertiary,
          }}
        >
          <span>#</span>
          <span>Validator</span>
          <span>Voting Power</span>
          <span>Commission</span>
          <span className="text-right">Status</span>
        </div>

        {data.map((v, index) => {
          const percentage = v.votingPowerPercent
          const isActive = v.status === 'BOND_STATUS_BONDED' && !v.jailed
          const statusLabel = v.jailed ? 'Jailed' : isActive ? 'Active' : 'Inactive'
          const statusColor = v.jailed
            ? colors.status.warning
            : isActive
              ? colors.status.success
              : colors.status.error

          return (
            <Link
              key={v.operatorAddress}
              to={`/validators/${encodeURIComponent(v.identity || v.moniker)}`}
              className="reference-table-row grid gap-3 border-b px-5 py-4 md:grid-cols-[44px_1.6fr_1.1fr_100px_84px] md:items-center"
              style={{ borderColor: colors.border.primary }}
            >
              <span
                className="font-mono text-[13px]"
                style={{ color: colors.text.tertiary }}
              >
                {page * PER_PAGE + index + 1}
              </span>

              <div className="flex min-w-0 items-center gap-2.5">
                <ValidatorIcon
                  moniker={v.moniker}
                  identity={v.identity}
                  size="md"
                />
                <span
                  className="truncate text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {v.moniker}
                </span>
              </div>

              <div className="flex flex-col gap-[5px]">
                <div className="flex items-center justify-between gap-4">
                  <span
                    className="font-mono text-[12px]"
                    style={{ color: colors.text.primary }}
                  >
                    {formatVotingPower(v.tokens, v.bondDenom)}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    {percentage.toFixed(2)}%
                  </span>
                </div>
                <div
                  className="h-[5px] overflow-hidden rounded-[3px]"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <div
                    className="h-full rounded-[3px]"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
                    }}
                  />
                </div>
              </div>

              <span
                className="text-[12.5px]"
                style={{ color: colors.text.secondary }}
              >
                {convertRateToPercent(v.commissionRate)}
              </span>

              <span
                className="reference-pill w-fit justify-self-end"
                style={{
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            </Link>
          )
        })}

        {!validatorsQuery.isLoading && data.length === 0 && (
          <div className="px-5 py-12 text-center">
            <FiUsers
              className="mx-auto mb-4 h-12 w-12 opacity-50"
              style={{ color: colors.text.tertiary }}
            />
            <p style={{ color: colors.text.secondary }}>
              No validators available
            </p>
          </div>
        )}

        <div
          className="flex items-center justify-between border-t px-5 py-[14px]"
          style={{ borderColor: colors.border.primary }}
        >
          <span className="text-xs" style={{ color: colors.text.tertiary }}>
            Showing {page * PER_PAGE + 1}–
            {Math.min((page + 1) * PER_PAGE, totalListed)} of {totalListed}{' '}
            validators
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
              disabled={(page + 1) * PER_PAGE >= totalListed}
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
    </div>
  )
}

export default Validators
