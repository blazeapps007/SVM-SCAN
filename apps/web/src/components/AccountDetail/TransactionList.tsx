import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/theme/ThemeProvider'
import type { Coin, TransactionSummary } from '@dexplorer/shared'
import { formatCoinAmount } from '@dexplorer/shared'
import { trimHash, getTypeMsg } from '@/utils/helper'
import { getResultPillStyle } from '@/utils/pillStyle'
import { FiUser } from 'react-icons/fi'

interface TransactionListProps {
  transactions: TransactionSummary[]
  totalCount: number
}

const formatFee = (coins: Coin[] | undefined) => {
  const fee = coins?.[0]
  if (!fee) return '—'
  return formatCoinAmount(fee.amount, fee.denom)
}

export default function TransactionList({
  transactions,
  totalCount,
}: TransactionListProps) {
  const { colors } = useTheme()

  const rows = transactions
    .slice(0, 10)
    .map((tx) => ({ tx, fee: formatFee(tx.fee) }))

  const renderTransactionMessages = (messageTypes: string[]) => {
    if (messageTypes.length === 0) return 'No messages'

    if (messageTypes.length === 1) {
      return (
        <span
          className="reference-pill w-fit"
          style={{
            backgroundColor: `${colors.primary}20`,
            color: colors.primary,
          }}
        >
          {getTypeMsg(messageTypes[0])}
        </span>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <span
          className="reference-pill w-fit"
          style={{
            backgroundColor: `${colors.primary}20`,
            color: colors.primary,
          }}
        >
          {getTypeMsg(messageTypes[0])}
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: colors.primary }}
        >
          +{messageTypes.length - 1}
        </span>
      </div>
    )
  }

  return (
    <div className="reference-table-shell">
      <div
        className="border-b px-5 py-[15px] text-[14px] font-semibold"
        style={{
          borderColor: colors.border.primary,
          color: colors.text.primary,
        }}
      >
        Recent Transactions ({totalCount})
      </div>

      {rows.length > 0 ? (
        <>
          <div
            className="reference-table-header hidden gap-3 border-b px-5 py-3 md:grid md:grid-cols-[1.6fr_110px_130px_100px_110px]"
            style={{ borderColor: colors.border.primary }}
          >
            <span>Tx Hash</span>
            <span>Height</span>
            <span>Messages</span>
            <span>Result</span>
            <span className="text-right">Fee</span>
          </div>

          {rows.map(({ tx, fee }, index) => (
            <div
              key={index}
              className="reference-table-row grid gap-3 border-b px-5 py-4 md:grid-cols-[1.6fr_110px_130px_100px_110px] md:items-center"
              style={{ borderColor: colors.border.primary }}
            >
              <Link
                to={`/tx/${tx.hash}`}
                className="truncate font-mono text-[12.5px]"
                style={{ color: colors.primary }}
              >
                {trimHash(tx.hash)}
              </Link>
              <Link
                to={`/blocks/${tx.height}`}
                className="font-mono text-[12.5px]"
                style={{ color: colors.text.secondary }}
              >
                {tx.height}
              </Link>
              <div>{renderTransactionMessages(tx.messageTypes)}</div>
              <span
                className="reference-pill w-fit"
                style={getResultPillStyle(tx.success, colors)}
              >
                {tx.success ? 'Success' : 'Failed'}
              </span>
              <span
                className="font-mono text-[12.5px] md:text-right"
                style={{ color: colors.text.primary }}
              >
                {fee}
              </span>
            </div>
          ))}
        </>
      ) : (
        <div className="px-5 py-10 text-center">
          <FiUser
            className="mx-auto mb-4 h-12 w-12"
            style={{ color: colors.text.tertiary }}
          />
          <p style={{ color: colors.text.secondary }}>No transactions found</p>
        </div>
      )}
    </div>
  )
}
