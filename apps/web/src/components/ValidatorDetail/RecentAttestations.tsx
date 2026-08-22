import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/theme/ThemeProvider'
import type { ThemeColors } from '@/theme/colors'
import {
  bridgeAssetSymbol,
  convertRawAmount,
  timeFromNow,
  trimHash,
} from '@/utils/helper'
import { useValidatorAttestations } from '@/hooks/useValidatorExtras'

interface RecentAttestationsProps {
  identity: string
}

const getStatusColor = (status: string, colors: ThemeColors): string => {
  if (status.endsWith('MINTED') || status.endsWith('PROCESSED')) {
    return colors.status.success
  }
  if (status.endsWith('PENDING') || status.endsWith('REQUESTED')) {
    return colors.status.warning
  }
  if (status.endsWith('UNCLAIMABLE') || status.endsWith('REFUNDED')) {
    return colors.status.error
  }
  return colors.text.tertiary
}

export default function RecentAttestations({
  identity,
}: RecentAttestationsProps) {
  const { colors } = useTheme()
  const { attestations, isLoading } = useValidatorAttestations(identity)

  return (
    <div className="panel-surface flex flex-col gap-3 rounded-[14px] px-6 py-5">
      <span
        className="text-[14px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        Recent Bridge Attestations
      </span>

      {isLoading ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          Loading...
        </p>
      ) : attestations.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          No bridge deposit/withdrawal attestations from this validator yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {attestations.map((a) => (
            <Link
              key={`${a.type}-${a.id}`}
              to={
                a.type === 'deposit'
                  ? `/bridge/deposits/${a.id}`
                  : `/bridge/withdrawals/${a.id}`
              }
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-4 py-3 hover:opacity-80"
              style={{ borderColor: colors.border.primary }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="reference-pill"
                  style={{
                    backgroundColor: `${colors.primary}20`,
                    color: colors.primary,
                  }}
                >
                  {a.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                </span>
                <span
                  className="font-mono text-[12px]"
                  style={{ color: colors.text.secondary }}
                  title={a.txRef}
                >
                  {trimHash(a.txRef, 10)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-[12.5px]"
                  style={{ color: colors.text.primary }}
                >
                  {convertRawAmount(a.amountMillisteem, 3)}{' '}
                  {bridgeAssetSymbol(a.asset)}
                </span>
                <span
                  className="reference-pill"
                  style={{
                    backgroundColor: `${getStatusColor(a.status, colors)}20`,
                    color: getStatusColor(a.status, colors),
                  }}
                >
                  {a.status.replace(/^(DEPOSIT|WITHDRAWAL)_STATUS_/, '')}
                </span>
                <span
                  className="text-[11.5px]"
                  style={{ color: colors.text.tertiary }}
                >
                  {timeFromNow(
                    new Date(Number(a.confirmedAt) * 1000).toISOString()
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
