import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FiAlertTriangle,
  FiChevronLeft,
  FiShield,
  FiKey,
  FiCheckCircle,
  FiXCircle,
  FiLoader,
} from 'react-icons/fi'
import { fromBase64, toHex } from '@cosmjs/encoding'
import { useTheme } from '@/theme/ThemeProvider'
import { apiClient } from '@/lib/apiClient'
import type { Coin, ValidatorDetailResponse } from '@dexplorer/shared'
import { formatAmount, getConvertedAmount } from '@dexplorer/shared'
import {
  convertRateToPercent,
  parseDetailsLines,
  fetchWithTimeout,
} from '@/utils/helper'
import ValidatorIcon from '@/components/ValidatorIcon'
import CopyText from '@/components/ui/CopyText'

const formatVotingPower = (tokens: string, bondDenom: string): string => {
  if (!bondDenom) return tokens
  const { converted, base } = getConvertedAmount(tokens, bondDenom)
  return `${formatAmount(converted)} ${base.toUpperCase()}`
}

// pendingRewards/accumulatedCommission are Coin[] (almost always a single
// asteem entry, but the distribution module always returns an array) —
// null means the live query failed, [] means genuinely zero.
const formatRewardCoins = (coins: Coin[] | null): string => {
  if (!coins) return 'Unavailable'
  if (coins.length === 0) return '0'
  return coins
    .map((coin) => formatVotingPower(coin.amount, coin.denom))
    .join(', ')
}

const formatUptime = (
  missedBlocksCounter: string,
  signedBlocksWindow: string
): string | null => {
  const missed = Number(missedBlocksCounter)
  const window = Number(signedBlocksWindow)
  if (!window || window <= 0) return null
  const percent = (1 - missed / window) * 100
  return `${percent.toFixed(2)}%`
}

const getPubkeyHex = (consensusPubkey: string | null): string | null => {
  if (!consensusPubkey) return null
  try {
    const parsed = JSON.parse(consensusPubkey) as { value: string }
    return parsed.value ? toHex(fromBase64(parsed.value)) : null
  } catch {
    return null
  }
}

const ValidatorDetail: React.FC = () => {
  const { identity } = useParams<{ identity: string }>()
  const { colors } = useTheme()
  const [keybaseUsername, setKeybaseUsername] = useState<string | null>(null)

  const {
    data: validator,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['validator', identity],
    queryFn: () =>
      apiClient.get<ValidatorDetailResponse>(
        `/validators/${encodeURIComponent(identity ?? '')}`
      ),
    enabled: Boolean(identity),
    retry: false,
  })

  const pubkeyHex = useMemo(
    () => getPubkeyHex(validator?.consensusPubkey ?? null),
    [validator]
  )

  const detailsLines = useMemo(
    () => (validator?.details ? parseDetailsLines(validator.details) : null),
    [validator]
  )

  const uptime = useMemo(() => {
    if (!validator?.uptime) return null
    return formatUptime(
      validator.uptime.missedBlocksCounter,
      validator.uptime.signedBlocksWindow
    )
  }, [validator])

  // Resolve Keybase identity to username
  useEffect(() => {
    if (!validator?.identity) return

    let isMounted = true
    const resolveUsername = async () => {
      try {
        const res = await fetchWithTimeout(
          `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validator.identity}&fields=basics`
        )
        const data = await res.json()
        if (isMounted && data?.them?.[0]?.basics?.username) {
          setKeybaseUsername(data.them[0].basics.username)
        }
      } catch {
        // Keybase API unavailable, show identity as plain text
      }
    }
    resolveUsername()
    return () => {
      isMounted = false
    }
  }, [validator?.identity])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <FiLoader
          className="h-8 w-8 animate-spin"
          style={{ color: colors.primary }}
        />
      </div>
    )
  }

  if (isError || !validator) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Link
          to="/validators"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: colors.text.secondary }}
        >
          <FiChevronLeft className="h-4 w-4" />
          Back to validators
        </Link>

        <div className="panel-surface rounded-[14px] p-12 text-center">
          <FiXCircle
            className="mx-auto mb-4 h-16 w-16"
            style={{ color: colors.status.error }}
          />
          <h2
            className="mb-2 text-xl font-semibold"
            style={{ color: colors.text.primary }}
          >
            Validator Not Found
          </h2>
          <p className="mb-6" style={{ color: colors.text.secondary }}>
            The validator you're looking for doesn't exist or couldn't be
            loaded.
          </p>
          <Link
            to="/validators"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2"
            style={{
              backgroundColor: colors.primary,
              color: colors.background,
            }}
          >
            Back to Validators
          </Link>
        </div>
      </div>
    )
  }

  const isActive = validator.status === 'BOND_STATUS_BONDED' && !validator.jailed
  const votingPowerPercent = validator.votingPowerPercent.toFixed(2)
  const statusColor = validator.jailed
    ? colors.status.warning
    : isActive
      ? colors.status.success
      : colors.status.error

  return (
    <div className="flex flex-col gap-[18px]">
      <Link
        to="/validators"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: colors.text.secondary }}
      >
        <FiChevronLeft className="h-4 w-4" />
        Back to validators
      </Link>

      {/* Header */}
      <div className="panel-surface flex flex-col gap-[14px] rounded-[14px] px-6 py-[22px]">
        <div className="flex flex-wrap items-start gap-[15px]">
          <ValidatorIcon
            moniker={validator.moniker}
            identity={validator.identity}
            size="lg"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <div className="flex flex-wrap items-center gap-[11px]">
              <span
                className="text-[21px] font-semibold tracking-[-0.01em]"
                style={{ color: colors.text.primary }}
              >
                {validator.moniker}
              </span>
              <span
                className="reference-pill"
                style={{
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                }}
              >
                {validator.jailed ? (
                  <>
                    <FiAlertTriangle className="mr-1 h-3 w-3" />
                    Jailed
                  </>
                ) : isActive ? (
                  <>
                    <FiCheckCircle className="mr-1 h-3 w-3" />
                    Active
                  </>
                ) : (
                  <>
                    <FiXCircle className="mr-1 h-3 w-3" />
                    Inactive
                  </>
                )}
              </span>
            </div>
            {validator.identity && (
              <div className="flex flex-wrap items-center gap-2">
                <CopyText
                  text={validator.identity}
                  className="font-mono text-[12px]"
                  style={{ color: colors.text.tertiary }}
                />
              </div>
            )}
            {validator.website && (
              <a
                href={validator.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] hover:underline"
                style={{ color: colors.primary }}
              >
                {validator.website}
              </a>
            )}
          </div>
        </div>
        {validator.details && detailsLines ? (
          <div className="flex flex-col gap-1">
            {detailsLines.map(({ key, value }) => (
              <p
                key={key}
                className="text-[13.5px] leading-[1.55] break-all"
                style={{ color: colors.text.secondary }}
              >
                <span
                  className="font-semibold capitalize"
                  style={{ color: colors.text.primary }}
                >
                  {key}:
                </span>{' '}
                <span className="font-mono text-[12.5px]">{value}</span>
              </p>
            ))}
          </div>
        ) : (
          validator.details && (
            <p
              className="text-[13.5px] leading-[1.55]"
              style={{ color: colors.text.secondary }}
            >
              {validator.details}
            </p>
          )
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="panel-surface flex flex-col gap-[7px] rounded-[14px] px-[19px] py-[17px]">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: colors.text.tertiary }}
          >
            Voting Power
          </span>
          <span
            className="font-mono text-[20px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {formatVotingPower(validator.tokens, validator.bondDenom)}
          </span>
          <span
            className="text-[11.5px]"
            style={{ color: colors.text.secondary }}
          >
            {votingPowerPercent}% of bonded
          </span>
        </div>

        <div className="panel-surface flex flex-col gap-[7px] rounded-[14px] px-[19px] py-[17px]">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: colors.text.tertiary }}
          >
            Commission
          </span>
          <span
            className="font-mono text-[20px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {convertRateToPercent(validator.commissionRate)}
          </span>
          <span
            className="text-[11.5px]"
            style={{ color: colors.text.secondary }}
          >
            Commission rate
          </span>
        </div>

        <div className="panel-surface flex flex-col gap-[7px] rounded-[14px] px-[19px] py-[17px]">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: colors.text.tertiary }}
          >
            Uptime
          </span>
          <span
            className="font-mono text-[20px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {uptime ?? 'N/A'}
          </span>
          <span
            className="text-[11.5px]"
            style={{ color: colors.text.secondary }}
          >
            Signed blocks
          </span>
        </div>

        <div className="panel-surface flex flex-col gap-[7px] rounded-[14px] px-[19px] py-[17px]">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: colors.text.tertiary }}
          >
            Status
          </span>
          <span
            className="text-[20px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {isActive ? 'Bonded' : 'Unbonded'}
          </span>
          <span
            className="text-[11.5px]"
            style={{ color: colors.text.secondary }}
          >
            Validator status
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="reference-table-shell rounded-[14px]">
          <div
            className="border-b px-5 py-[15px] text-[14px] font-semibold"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          >
            Validator Information
          </div>
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: colors.border.primary }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Delegator Shares
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {formatVotingPower(
                validator.delegatorShares,
                validator.bondDenom
              )}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: colors.border.primary }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Pending Rewards
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {formatRewardCoins(validator.pendingRewards)}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: colors.border.primary }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Accumulated Commission
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {formatRewardCoins(validator.accumulatedCommission)}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: colors.border.primary }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Total Rewards Claimed (Lifetime)
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {formatRewardCoins(validator.totalRewardsClaimed)}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: colors.border.primary }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Min Self Delegation
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {formatVotingPower(
                validator.minSelfDelegation,
                validator.bondDenom
              )}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: colors.border.primary }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Unbonding Height
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {validator.unbondingHeight}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span
              className="shrink-0 text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              PubKey
            </span>
            {pubkeyHex ? (
              <CopyText
                text={pubkeyHex}
                displayText={pubkeyHex.substring(0, 20) + '...'}
                className="font-mono text-[12px] text-right"
                style={{ color: colors.text.primary }}
              />
            ) : (
              <span
                className="font-mono text-[12px]"
                style={{ color: colors.text.primary }}
              >
                N/A
              </span>
            )}
          </div>
        </div>

        <div className="reference-table-shell rounded-[14px]">
          <div
            className="border-b px-5 py-[15px] text-[14px] font-semibold"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          >
            Security
          </div>
          <div
            className="flex items-center gap-[10px] border-b px-5 py-[13px]"
            style={{ borderColor: colors.border.primary }}
          >
            <FiShield
              className="h-4 w-4"
              style={{ color: colors.status.success }}
            />
            <span
              className="text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              Validator signed the last block
            </span>
          </div>
          {validator.identity && (
            <div className="flex items-start gap-[10px] px-5 py-[13px]">
              <FiKey
                className="mt-0.5 h-4 w-4"
                style={{ color: colors.status.info }}
              />
              <div className="flex flex-col gap-[2px]">
                <span
                  className="text-[12.5px]"
                  style={{ color: colors.text.secondary }}
                >
                  Keybase Identity
                </span>
                {keybaseUsername ? (
                  <a
                    href={`https://keybase.io/${encodeURIComponent(keybaseUsername)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[12.5px] hover:underline"
                    style={{ color: colors.primary }}
                  >
                    {keybaseUsername}
                  </a>
                ) : (
                  <span
                    className="font-mono text-[12.5px]"
                    style={{ color: colors.text.primary }}
                  >
                    {validator.identity}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delegator Info */}
      <div className="panel-surface flex flex-col gap-[6px] rounded-[14px] px-[22px] py-[18px]">
        <span
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Delegator Info
        </span>
        <p
          className="text-[13px] leading-[1.55]"
          style={{ color: colors.text.secondary }}
        >
          To delegate or undelegate to this validator, please use the SVM App.
          This is a read-only block explorer.
        </p>
        <a
          href="https://svmapp.blazeapps.org/validators"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium hover:underline"
          style={{ color: colors.primary }}
        >
          Open SVM App →
        </a>
      </div>
    </div>
  )
}

export default ValidatorDetail
