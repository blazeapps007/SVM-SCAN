import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiRepeat } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { trimHash, convertRawAmount } from '@/utils/helper'
import type { BridgeWithdrawal } from '@dexplorer/shared'
import {
  useBridgeWithdrawals,
  useBridgeWithdrawalStats,
  type BridgeWithdrawalStatusFilter,
} from '@/hooks/useBridgeWithdrawals'

const STATUS_TABS: { label: string; value: BridgeWithdrawalStatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Requested', value: 'requested' },
]

const STATUS_LABELS: Record<BridgeWithdrawal['status'], string> = {
  WITHDRAWAL_STATUS_REQUESTED: 'Requested',
}

const formatAmount = (amountAsteem: string): string =>
  `${convertRawAmount(amountAsteem, 18)} STEEM`

const BridgeWithdrawals: React.FC = () => {
  const { colors } = useTheme()
  const [status, setStatus] = useState<BridgeWithdrawalStatusFilter>('all')
  const [page, setPage] = useState(0)

  const { withdrawals, total, perPage, isLoading } = useBridgeWithdrawals(
    status,
    page
  )
  const stats = useBridgeWithdrawalStats()

  const changeStatus = (value: BridgeWithdrawalStatusFilter) => {
    setStatus(value)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Withdrawals', value: stats.total.toLocaleString() },
            { label: 'Requested', value: stats.requested.toLocaleString() },
            {
              label: 'Total Minted',
              value: `${convertRawAmount(stats.totalMintedAsteem, 18)} STEEM`,
            },
            {
              label: 'Total Burned',
              value: `${convertRawAmount(stats.totalBurnedAsteem, 18)} STEEM`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="panel-surface rounded-[14px] px-5 py-4"
            >
              <p className="text-xs" style={{ color: colors.text.tertiary }}>
                {stat.label}
              </p>
              <p
                className="mt-1 text-xl font-semibold"
                style={{ color: colors.text.primary }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => changeStatus(tab.value)}
            className="rounded-[8px] border px-[13px] py-[7px] text-[12.5px] font-medium transition-opacity"
            style={
              status === tab.value
                ? {
                    backgroundColor: `${colors.primary}18`,
                    borderColor: `${colors.primary}66`,
                    color: colors.primary,
                  }
                : {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border.primary,
                    color: colors.text.tertiary,
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="reference-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: colors.border.primary }}
              >
                <th className="reference-table-header px-5 py-4 text-left">
                  Burn Tx
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Sender
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Destination (Steem)
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Amount
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Status
                </th>
                <th className="reference-table-header px-5 py-4 text-right">
                  SVM Block
                </th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((withdrawal) => (
                <tr
                  key={withdrawal.id}
                  className="reference-table-row border-b"
                  style={{ borderColor: colors.border.primary }}
                >
                  <td className="px-5 py-4">
                    <Link
                      to={`/bridge/withdrawals/${withdrawal.id}`}
                      className="font-mono text-sm hover:opacity-70 transition-opacity"
                      style={{ color: colors.primary }}
                    >
                      {trimHash(withdrawal.burnTxHash, 10)}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="font-mono text-xs"
                      style={{ color: colors.text.secondary }}
                    >
                      {trimHash(withdrawal.sender, 8)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {withdrawal.destinationSteemAccount}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="font-mono text-sm"
                      style={{ color: colors.text.primary }}
                    >
                      {formatAmount(withdrawal.amountAsteem)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="reference-pill"
                      style={{
                        backgroundColor: `${colors.status.warning}20`,
                        color: colors.status.warning,
                      }}
                    >
                      {STATUS_LABELS[withdrawal.status] ?? withdrawal.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/blocks/${withdrawal.createdAtHeight}`}
                      className="font-mono text-sm hover:opacity-70 transition-opacity"
                      style={{ color: colors.primary }}
                    >
                      {Number(withdrawal.createdAtHeight).toLocaleString()}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLoading && withdrawals.length === 0 && (
            <div className="py-12 text-center">
              <FiRepeat
                className="mx-auto mb-4 h-12 w-12 opacity-50"
                style={{ color: colors.text.tertiary }}
              />
              <p style={{ color: colors.text.secondary }}>
                No bridge withdrawals found
              </p>
            </div>
          )}
        </div>

        {total > perPage && (
          <div
            className="flex items-center justify-between border-t px-5 py-[14px]"
            style={{ borderColor: colors.border.primary }}
          >
            <span className="text-xs" style={{ color: colors.text.tertiary }}>
              Showing {page * perPage + 1}–
              {Math.min((page + 1) * perPage, total)} of {total} withdrawals
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
      </div>
    </div>
  )
}

export default BridgeWithdrawals
