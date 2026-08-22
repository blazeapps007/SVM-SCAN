import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { useBridgeWithdrawal } from '@/hooks/useBridgeWithdrawals'
import { trimHash, convertRawAmount, bridgeAssetSymbol } from '@/utils/helper'
import CopyText from '@/components/ui/CopyText'

const STATUS_LABELS: Record<string, string> = {
  WITHDRAWAL_STATUS_REQUESTED: 'Requested',
  WITHDRAWAL_STATUS_PROCESSED: 'Processed',
  WITHDRAWAL_STATUS_REFUNDED: 'Refunded',
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

  const statusColor =
    withdrawal.status === 'WITHDRAWAL_STATUS_PROCESSED'
      ? colors.status.success
      : withdrawal.status === 'WITHDRAWAL_STATUS_REFUNDED'
        ? colors.status.error
        : colors.status.warning

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
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {STATUS_LABELS[withdrawal.status] ?? withdrawal.status}
          </span>
        </div>

        <div
          className="flex flex-col divide-y"
          style={{ borderColor: colors.border.primary }}
        >
          <InfoRow label="Amount">
            {convertRawAmount(withdrawal.amountAsteem, 18)}{' '}
            {bridgeAssetSymbol(withdrawal.asset)}
          </InfoRow>
          <InfoRow label="Bridge Fee">
            {convertRawAmount(withdrawal.feeMillisteem, 3)}{' '}
            {bridgeAssetSymbol(withdrawal.asset)}
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
              to={`/tx/${withdrawal.burnTxHash}`}
              className="font-mono hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              {trimHash(withdrawal.burnTxHash, 14)}
            </Link>
          </InfoRow>
          {withdrawal.steemPayoutTxid && (
            <InfoRow label="Steem Payout Txid">
              <CopyText
                text={withdrawal.steemPayoutTxid}
                displayText={trimHash(withdrawal.steemPayoutTxid, 14)}
              />
            </InfoRow>
          )}
          <InfoRow label="SVM Block">
            <Link
              to={`/blocks/${withdrawal.createdAtHeight}`}
              className="font-mono hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              {Number(withdrawal.createdAtHeight).toLocaleString()}
            </Link>
          </InfoRow>
          {withdrawal.processedAtHeight !== '0' && (
            <InfoRow label="Processed At">
              <Link
                to={`/blocks/${withdrawal.processedAtHeight}`}
                className="font-mono hover:opacity-70 transition-opacity"
                style={{ color: colors.primary }}
              >
                {Number(withdrawal.processedAtHeight).toLocaleString()}
              </Link>
            </InfoRow>
          )}
          {withdrawal.refundedAtHeight !== '0' && (
            <InfoRow label="Refunded At">
              <Link
                to={`/blocks/${withdrawal.refundedAtHeight}`}
                className="font-mono hover:opacity-70 transition-opacity"
                style={{ color: colors.primary }}
              >
                {Number(withdrawal.refundedAtHeight).toLocaleString()}
              </Link>
            </InfoRow>
          )}
        </div>
      </div>

      <div className="panel-surface flex flex-col gap-4 rounded-[14px] px-6 py-[22px]">
        <h2
          className="font-heading text-base font-semibold"
          style={{ color: colors.text.primary }}
        >
          Oracle Confirmations ({withdrawal.validatorConfirmations.length})
        </h2>
        <div className="flex flex-col gap-2">
          {withdrawal.validatorConfirmations.map((confirmation) => (
            <div
              key={confirmation.validatorAddress}
              className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <div className="flex items-center gap-2">
                <FiCheckCircle
                  className="h-4 w-4"
                  style={{ color: colors.status.success }}
                />
                {confirmation.moniker ? (
                  <Link
                    to={`/validators/${confirmation.validatorAddress}`}
                    className="text-sm font-medium hover:opacity-70 transition-opacity"
                    style={{ color: colors.primary }}
                  >
                    {confirmation.moniker}
                  </Link>
                ) : (
                  <span
                    className="font-mono text-sm"
                    style={{ color: colors.text.secondary }}
                  >
                    {trimHash(confirmation.validatorAddress, 10)}
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ color: colors.text.tertiary }}>
                {new Date(
                  Number(confirmation.timestamp) * 1000
                ).toLocaleString()}
              </span>
            </div>
          ))}
          {withdrawal.validatorConfirmations.length === 0 && (
            <p className="text-sm" style={{ color: colors.text.tertiary }}>
              No oracle confirmations yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default BridgeWithdrawalDetail
