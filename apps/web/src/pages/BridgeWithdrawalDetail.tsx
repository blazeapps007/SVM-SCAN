import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiAlertCircle } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { useBridgeWithdrawal } from '@/hooks/useBridgeWithdrawals'
import { trimHash, convertRawAmount } from '@/utils/helper'
import CopyText from '@/components/ui/CopyText'

const STATUS_LABELS: Record<string, string> = {
  WITHDRAWAL_STATUS_REQUESTED: 'Requested',
}

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const { colors } = useTheme()
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span
        className="w-40 shrink-0 text-sm"
        style={{ color: colors.text.tertiary }}
      >
        {label}
      </span>
      <div className="text-sm" style={{ color: colors.text.primary }}>
        {children}
      </div>
    </div>
  )
}

const BridgeWithdrawalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { colors } = useTheme()
  const { withdrawal, isLoading, error } = useBridgeWithdrawal(id)

  if (isLoading) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>Loading withdrawal...</p>
      </div>
    )
  }

  if (error || !withdrawal) {
    return (
      <div className="panel-surface rounded-[14px] px-6 py-12 text-center">
        <FiAlertCircle
          className="mx-auto mb-4 h-16 w-16"
          style={{ color: colors.status.error }}
        />
        <h2
          className="mb-2 text-xl font-semibold"
          style={{ color: colors.text.primary }}
        >
          Withdrawal Not Found
        </h2>
        <p style={{ color: colors.text.secondary }}>
          The bridge withdrawal you're looking for doesn't exist or couldn't
          be loaded.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="panel-surface flex flex-col gap-6 rounded-[14px] px-6 py-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1
            className="font-heading text-xl font-semibold"
            style={{ color: colors.text.primary }}
          >
            Bridge Withdrawal #{withdrawal.id}
          </h1>
          <span
            className="reference-pill"
            style={{
              backgroundColor: `${colors.status.warning}20`,
              color: colors.status.warning,
            }}
          >
            {STATUS_LABELS[withdrawal.status] ?? withdrawal.status}
          </span>
        </div>

        <div
          className="flex flex-col divide-y"
          style={{ borderColor: colors.border.primary }}
        >
          <InfoRow label="Amount">
            {convertRawAmount(withdrawal.amountAsteem, 18)} STEEM
          </InfoRow>
          <InfoRow label="Sender">
            <CopyText
              text={withdrawal.sender}
              displayText={trimHash(withdrawal.sender, 14)}
            />
          </InfoRow>
          <InfoRow label="Destination (Steem)">
            {withdrawal.destinationSteemAccount}
          </InfoRow>
          <InfoRow label="Memo">{withdrawal.memo || '—'}</InfoRow>
          <InfoRow label="Burn Transaction">
            <Link
              to={`/txs/${withdrawal.burnTxHash}`}
              className="font-mono hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              {trimHash(withdrawal.burnTxHash, 14)}
            </Link>
          </InfoRow>
          <InfoRow label="SVM Block">
            <Link
              to={`/blocks/${withdrawal.createdAtHeight}`}
              className="font-mono hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              {Number(withdrawal.createdAtHeight).toLocaleString()}
            </Link>
          </InfoRow>
        </div>
      </div>
    </div>
  )
}

export default BridgeWithdrawalDetail
