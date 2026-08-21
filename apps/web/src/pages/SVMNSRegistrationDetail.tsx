import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { useNameRegistration } from '@/hooks/useNameService'
import { trimHash, displayDate, convertRawAmount } from '@/utils/helper'
import CopyText from '@/components/ui/CopyText'
import { ThemeColors } from '@/theme/colors'

const getStatusColor = (status: string, colors: ThemeColors): string => {
  if (status.includes('ACTIVE')) return colors.status.success
  if (status.includes('PENDING') || status.includes('AWAITING'))
    return colors.status.warning
  if (status.includes('EXPIRED') || status.includes('SUPERSEDED'))
    return colors.status.error
  return colors.text.secondary
}

const formatStatusLabel = (status: string): string => {
  const stripped = status.replace('NAME_REGISTRATION_STATUS_', '')
  return stripped.charAt(0) + stripped.slice(1).toLowerCase()
}

const formatSteemTimestamp = (raw: string): string =>
  raw === 'genesis' ? 'Genesis' : displayDate(raw)

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const { colors } = useTheme()
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-40 shrink-0 text-sm" style={{ color: colors.text.tertiary }}>
        {label}
      </span>
      <div className="text-sm" style={{ color: colors.text.primary }}>
        {children}
      </div>
    </div>
  )
}

const SVMNSRegistrationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { colors } = useTheme()
  const { registration, isLoading, error } = useNameRegistration(id)

  if (isLoading) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>Loading registration...</p>
      </div>
    )
  }

  if (error || !registration) {
    return (
      <div className="panel-surface rounded-[14px] px-6 py-12 text-center">
        <FiAlertCircle className="mx-auto mb-4 h-16 w-16" style={{ color: colors.status.error }} />
        <h2 className="mb-2 text-xl font-semibold" style={{ color: colors.text.primary }}>
          Registration Not Found
        </h2>
        <p style={{ color: colors.text.secondary }}>
          The name registration you're looking for doesn't exist or couldn't be loaded.
        </p>
      </div>
    )
  }

  const statusColor = getStatusColor(registration.status, colors)

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="panel-surface flex flex-col gap-6 rounded-[14px] px-6 py-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-xl font-semibold" style={{ color: colors.text.primary }}>
            {registration.steemAccount}
          </h1>
          <span
            className="reference-pill"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {formatStatusLabel(registration.status)}
          </span>
        </div>

        <div className="flex flex-col divide-y" style={{ borderColor: colors.border.primary }}>
          <InfoRow label="Destination">
            <CopyText
              text={registration.derivedDestination}
              displayText={trimHash(registration.derivedDestination, 14)}
            />
          </InfoRow>
          <InfoRow label="Amount Minted">
            {convertRawAmount(registration.amountMillisteem, 3)} STEEM
            <span
              className="ml-2 text-xs"
              style={{ color: colors.text.tertiary }}
            >
              — minted to the destination on confirmation, same as a bridge
              deposit. Not a fee; nothing is withheld.
            </span>
          </InfoRow>
          <InfoRow label="Steem Txid">
            <CopyText text={registration.txid} displayText={trimHash(registration.txid, 14)} />
          </InfoRow>
          <InfoRow label="Steem Block">{registration.steemBlock}</InfoRow>
          <InfoRow label="Steem Timestamp">
            {formatSteemTimestamp(registration.steemTimestamp)}
          </InfoRow>
          <InfoRow label="Memo">{registration.memo || '—'}</InfoRow>
          <InfoRow label="SVM Block">
            <Link
              to={`/blocks/${registration.createdAtHeight}`}
              className="font-mono hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              {Number(registration.createdAtHeight).toLocaleString()}
            </Link>
          </InfoRow>
          {registration.confirmTxHash && (
            <InfoRow label="Confirm Transaction">
              <Link
                to={`/txs/${registration.confirmTxHash}`}
                className="font-mono hover:opacity-70 transition-opacity"
                style={{ color: colors.primary }}
              >
                {trimHash(registration.confirmTxHash, 14)}
              </Link>
            </InfoRow>
          )}
        </div>
      </div>

      <div className="panel-surface flex flex-col gap-4 rounded-[14px] px-6 py-[22px]">
        <h2 className="font-heading text-base font-semibold" style={{ color: colors.text.primary }}>
          Oracle Confirmations ({registration.validatorConfirmations.length})
        </h2>
        <div className="flex flex-col gap-2">
          {registration.validatorConfirmations.map((confirmation) => (
            <div
              key={confirmation.validatorAddress}
              className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <div className="flex items-center gap-2">
                <FiCheckCircle className="h-4 w-4" style={{ color: colors.status.success }} />
                {confirmation.moniker ? (
                  <Link
                    to={`/validators/${confirmation.validatorAddress}`}
                    className="text-sm font-medium hover:opacity-70 transition-opacity"
                    style={{ color: colors.primary }}
                  >
                    {confirmation.moniker}
                  </Link>
                ) : (
                  <span className="font-mono text-sm" style={{ color: colors.text.secondary }}>
                    {trimHash(confirmation.validatorAddress, 10)}
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ color: colors.text.tertiary }}>
                {new Date(Number(confirmation.timestamp) * 1000).toLocaleString()}
              </span>
            </div>
          ))}
          {registration.validatorConfirmations.length === 0 && (
            <p className="text-sm" style={{ color: colors.text.tertiary }}>
              No oracle confirmations yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default SVMNSRegistrationDetail
