import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { useBridgeDeposit } from '@/hooks/useBridgeDeposits'
import {
  trimHash,
  displayDate,
  convertRawAmount,
  bridgeAssetSymbol,
} from '@/utils/helper'
import CopyText from '@/components/ui/CopyText'

const STATUS_LABELS: Record<string, string> = {
  DEPOSIT_STATUS_PENDING: 'Pending',
  DEPOSIT_STATUS_MINTED: 'Minted',
  DEPOSIT_STATUS_UNCLAIMABLE: 'Unclaimable',
}

const DESTINATION_LABELS: Record<string, string> = {
  DESTINATION_TYPE_NONE: 'None',
  DESTINATION_TYPE_COSMOS: 'Cosmos account',
  DESTINATION_TYPE_EVM: 'EVM account',
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

const BridgeDepositDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { colors } = useTheme()
  const { deposit, isLoading, error } = useBridgeDeposit(id)

  if (isLoading) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>Loading deposit...</p>
      </div>
    )
  }

  if (error || !deposit) {
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
          Deposit Not Found
        </h2>
        <p style={{ color: colors.text.secondary }}>
          The bridge deposit you're looking for doesn't exist or couldn't be
          loaded.
        </p>
      </div>
    )
  }

  const statusColor =
    deposit.status === 'DEPOSIT_STATUS_MINTED'
      ? colors.status.success
      : deposit.status === 'DEPOSIT_STATUS_PENDING'
        ? colors.status.warning
        : colors.status.error

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="panel-surface flex flex-col gap-6 rounded-[14px] px-6 py-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1
            className="font-heading text-xl font-semibold"
            style={{ color: colors.text.primary }}
          >
            Bridge Deposit #{deposit.id}
          </h1>
          <span
            className="reference-pill"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {STATUS_LABELS[deposit.status] ?? deposit.status}
          </span>
        </div>

        <div
          className="flex flex-col divide-y"
          style={{ borderColor: colors.border.primary }}
        >
          <InfoRow label="Steem Txid">
            <CopyText
              text={deposit.txid}
              displayText={trimHash(deposit.txid, 14)}
            />
          </InfoRow>
          <InfoRow label="Amount">
            {convertRawAmount(deposit.amountMillisteem, 3)}{' '}
            {bridgeAssetSymbol(deposit.asset)}
          </InfoRow>
          <InfoRow label="Steem Sender">{deposit.steemSender}</InfoRow>
          <InfoRow label="Gateway Account">{deposit.gatewayAccount}</InfoRow>
          <InfoRow label="Steem Block">{deposit.steemBlock}</InfoRow>
          <InfoRow label="Steem Timestamp">
            {displayDate(deposit.steemTimestamp)}
          </InfoRow>
          <InfoRow label="Memo">{deposit.memo || '—'}</InfoRow>
          <InfoRow label="Destination">
            {DESTINATION_LABELS[deposit.destinationType] ??
              deposit.destinationType}
            {deposit.derivedDestination && (
              <span
                className="ml-2 font-mono text-xs"
                style={{ color: colors.text.tertiary }}
              >
                {deposit.derivedDestination}
              </span>
            )}
          </InfoRow>
          <InfoRow label="SVM Block">
            <Link
              to={`/blocks/${deposit.createdAtHeight}`}
              className="font-mono hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              {Number(deposit.createdAtHeight).toLocaleString()}
            </Link>
          </InfoRow>
          {deposit.mintTxHash && (
            <InfoRow label="Mint Transaction">
              <Link
                to={`/txs/${deposit.mintTxHash}`}
                className="font-mono hover:opacity-70 transition-opacity"
                style={{ color: colors.primary }}
              >
                {trimHash(deposit.mintTxHash, 14)}
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
          Oracle Confirmations ({deposit.validatorConfirmations.length})
        </h2>
        <div className="flex flex-col gap-2">
          {deposit.validatorConfirmations.map((confirmation) => (
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
              <span
                className="text-xs"
                style={{ color: colors.text.tertiary }}
              >
                {new Date(
                  Number(confirmation.timestamp) * 1000
                ).toLocaleString()}
              </span>
            </div>
          ))}
          {deposit.validatorConfirmations.length === 0 && (
            <p className="text-sm" style={{ color: colors.text.tertiary }}>
              No oracle confirmations yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default BridgeDepositDetail
