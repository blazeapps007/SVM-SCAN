import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiRepeat } from 'react-icons/fi'
import type { BridgeDeposit } from '@dexplorer/shared'
import { useTheme } from '@/theme/ThemeProvider'
import { trimHash, timeFromNow, convertRawAmount } from '@/utils/helper'
import {
  useBridgeDeposits,
  useBridgeDepositStats,
  type BridgeDepositStatusFilter,
} from '@/hooks/useBridgeDeposits'
import { ThemeColors } from '@/theme/colors'

const STATUS_TABS: { label: string; value: BridgeDepositStatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Minted', value: 'minted' },
  { label: 'Unclaimable', value: 'unclaimable' },
]

const STATUS_LABELS: Record<BridgeDeposit['status'], string> = {
  DEPOSIT_STATUS_PENDING: 'Pending',
  DEPOSIT_STATUS_MINTED: 'Minted',
  DEPOSIT_STATUS_UNCLAIMABLE: 'Unclaimable',
}

const getStatusColor = (
  status: BridgeDeposit['status'],
  colors: ThemeColors
): string => {
  switch (status) {
    case 'DEPOSIT_STATUS_MINTED':
      return colors.status.success
    case 'DEPOSIT_STATUS_PENDING':
      return colors.status.warning
    case 'DEPOSIT_STATUS_UNCLAIMABLE':
      return colors.status.error
    default:
      return colors.text.secondary
  }
}

const StatusPill: React.FC<{ status: BridgeDeposit['status'] }> = ({
  status,
}) => {
  const { colors } = useTheme()
  const color = getStatusColor(status, colors)
  return (
    <span
      className="reference-pill"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

const formatAmount = (amountMillisteem: string): string =>
  `${convertRawAmount(amountMillisteem, 3)} STEEM`

const BridgeDeposits: React.FC = () => {
  const { colors } = useTheme()
  const [status, setStatus] = useState<BridgeDepositStatusFilter>('all')
  const [page, setPage] = useState(0)

  const { deposits, total, perPage, isLoading } = useBridgeDeposits(
    status,
    page
  )
  const stats = useBridgeDepositStats()

  const changeStatus = (value: BridgeDepositStatusFilter) => {
    setStatus(value)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Pending', value: stats.pending },
            { label: 'Minted', value: stats.minted },
            { label: 'Unclaimable', value: stats.unclaimable },
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
                {stat.value.toLocaleString()}
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
                  Steem Txid
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Sender
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Amount
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Status
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Confirmations
                </th>
                <th className="reference-table-header px-5 py-4 text-right">
                  Age
                </th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr
                  key={deposit.id}
                  className="reference-table-row border-b"
                  style={{ borderColor: colors.border.primary }}
                >
                  <td className="px-5 py-4">
                    <Link
                      to={`/bridge-deposits/${deposit.id}`}
                      className="font-mono text-sm hover:opacity-70 transition-opacity"
                      style={{ color: colors.primary }}
                    >
                      {trimHash(deposit.txid, 10)}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {deposit.steemSender}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="font-mono text-sm"
                      style={{ color: colors.text.primary }}
                    >
                      {formatAmount(deposit.amountMillisteem)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={deposit.status} />
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {deposit.validatorConfirmations.length}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {timeFromNow(deposit.steemTimestamp)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLoading && deposits.length === 0 && (
            <div className="py-12 text-center">
              <FiRepeat
                className="mx-auto mb-4 h-12 w-12 opacity-50"
                style={{ color: colors.text.tertiary }}
              />
              <p style={{ color: colors.text.secondary }}>
                No bridge deposits found
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
              {Math.min((page + 1) * perPage, total)} of {total} deposits
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

export default BridgeDeposits
