import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiActivity, FiCheck, FiCopy } from 'react-icons/fi'
import { toast } from 'sonner'
import type { Coin, Paginated, TransactionSummary } from '@dexplorer/shared'
import { formatCoinAmount } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useTheme } from '@/theme/ThemeProvider'
import { getTypeMsg, timeFromNow, trimHash } from '@/utils/helper'
import { getMessageTypePillStyle, getResultPillStyle } from '@/utils/pillStyle'

const CopyHashButton: React.FC<{ hash: string }> = ({ hash }) => {
  const { colors } = useTheme()
  const [copied, setCopied] = useState(false)

  const handleCopy = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    navigator.clipboard.writeText(hash)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      style={{ color: colors.text.secondary }}
      title="Copy transaction hash"
      aria-label="Copy transaction hash"
    >
      {copied ? (
        <FiCheck className="h-3 w-3 text-green-500" />
      ) : (
        <FiCopy className="h-3 w-3" />
      )}
    </button>
  )
}

const TYPE_LABELS: Record<string, string> = {
  Transfer: 'IBC Transfer',
  RecvPacket: 'IBC Receive',
  Acknowledgement: 'IBC Acknowledge',
  Timeout: 'IBC Timeout',
  WithdrawDelegatorReward: 'Withdraw Reward',
  Undelegate: 'Begin Unbonding',
}

const getFeeDisplay = (coins: Coin[] | undefined) => {
  const fee = coins?.[0]
  if (!fee) return '—'
  return formatCoinAmount(fee.amount, fee.denom)
}

const getTxType = (messageTypes: string[]): string => {
  if (!messageTypes.length) return 'Unknown'

  // Relayed IBC txs bundle a housekeeping MsgUpdateClient alongside the
  // message that actually matters (RecvPacket/Acknowledgement/Timeout) —
  // prefer that one over whichever message happens to be first.
  const primaryTypeUrl =
    messageTypes.find((typeUrl) => !typeUrl.endsWith('MsgUpdateClient')) ??
    messageTypes[0]
  const rawLabel = getTypeMsg(primaryTypeUrl)
  return TYPE_LABELS[rawLabel] || rawLabel || 'Unknown'
}

const Transactions: React.FC = () => {
  const { colors } = useTheme()

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'list'],
    queryFn: () =>
      apiClient.get<Paginated<TransactionSummary>>('/transactions?perPage=50'),
    refetchInterval: 6000,
  })

  const rows = useMemo(
    () =>
      (data?.data ?? []).map((tx) => ({
        ...tx,
        feeDisplay: getFeeDisplay(tx.fee),
        txType: getTxType(tx.messageTypes),
      })),
    [data]
  )

  return (
    <div className="space-y-5">
      <div className="reference-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: colors.border.primary }}
              >
                <th className="reference-table-header px-5 py-4 text-left">
                  Tx Hash
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Type
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Result
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Height
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Fee
                </th>
                <th className="reference-table-header px-5 py-4 text-right">
                  Age
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr
                  key={tx.hash}
                  className="reference-table-row border-b"
                  style={{ borderColor: colors.border.primary }}
                >
                  <td className="px-5 py-4">
                    <div className="group flex items-center gap-2">
                      <Link
                        to={`/txs/${tx.hash}`}
                        className="font-mono text-sm hover:opacity-70 transition-opacity"
                        style={{ color: colors.primary }}
                      >
                        {trimHash(tx.hash, 14)}
                      </Link>
                      <CopyHashButton hash={tx.hash} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="reference-pill"
                      style={getMessageTypePillStyle(tx.txType, colors)}
                    >
                      {tx.txType}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="reference-pill"
                      style={getResultPillStyle(tx.success, colors)}
                    >
                      {tx.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      to={`/blocks/${tx.height}`}
                      className="font-mono hover:opacity-70 transition-opacity"
                      style={{ color: colors.text.secondary }}
                    >
                      {Number(tx.height).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="font-mono text-sm"
                      style={{ color: colors.text.primary }}
                    >
                      {tx.feeDisplay}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {timeFromNow(tx.timestamp)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLoading && rows.length === 0 && (
            <div className="py-12 text-center">
              <FiActivity
                className="mx-auto mb-4 h-12 w-12 opacity-50"
                style={{ color: colors.text.tertiary }}
              />
              <p style={{ color: colors.text.secondary }}>
                No transactions yet
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: colors.text.tertiary }}
              >
                Transactions will appear here once the indexer catches up
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Transactions
