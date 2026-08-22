import React from 'react'
import type { Coin, ResolvedDenom } from '@dexplorer/shared'
import { formatAmount, formatDenom } from '@dexplorer/shared'
import { useTheme } from '@/theme/ThemeProvider'
import { convertRawAmount } from '@/utils/helper'

interface NativeBalanceTableProps {
  nativeTokens: readonly Coin[]
  nativeStakedToken: Coin | null
  resolvedDenoms: Record<string, ResolvedDenom>
}

export default function NativeBalanceTable({
  nativeTokens,
  nativeStakedToken,
  resolvedDenoms,
}: NativeBalanceTableProps) {
  const { colors } = useTheme()

  const formatBalance = (balance: Coin) => {
    const resolved = resolvedDenoms[balance.denom]
    const decimals =
      resolved?.decimals ??
      (balance.denom.startsWith('u') ? 6 : balance.denom.startsWith('a') ? 18 : 0)
    const symbol = resolved?.symbol ?? formatDenom(balance.denom)
    const converted = convertRawAmount(balance.amount, decimals)

    return {
      amount: balance.amount,
      convertedAmount: converted,
      formattedAmount: formatAmount(converted),
      denom: balance.denom,
      baseDenom: symbol,
      formattedDenom: symbol,
      isIBC: balance.denom.startsWith('ibc/'),
      isConverted: decimals > 0,
    }
  }

  if (nativeTokens.length === 0 && !nativeStakedToken) return null

  const metricCard = (
    key: string,
    label: string,
    value: string,
    token: string
  ) => (
    <div
      key={key}
      className="panel-surface flex flex-col gap-[7px] px-[19px] py-[17px]"
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: colors.text.tertiary }}
      >
        {label}
      </span>
      <span
        className="font-mono text-[20px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {value}
      </span>
      <span className="text-[11.5px]" style={{ color: colors.text.secondary }}>
        {token}
      </span>
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {nativeTokens.map((balance, index) => {
        const formatted = formatBalance(balance)
        const stakedForThisToken =
          nativeStakedToken && nativeStakedToken.denom === balance.denom
            ? nativeStakedToken
            : null
        const stakedFormatted = stakedForThisToken
          ? formatBalance(stakedForThisToken)
          : null

        return (
          <React.Fragment key={index}>
            {metricCard(
              `${index}-available`,
              'Available',
              formatted.formattedAmount,
              formatted.baseDenom.toUpperCase()
            )}
            {metricCard(
              `${index}-delegated`,
              'Delegated',
              stakedFormatted ? stakedFormatted.formattedAmount : '0',
              formatted.baseDenom.toUpperCase()
            )}
          </React.Fragment>
        )
      })}

      {nativeTokens.length === 0 &&
        nativeStakedToken &&
        (() => {
          const stakedFormatted = formatBalance(nativeStakedToken)
          return (
            <React.Fragment>
              {metricCard(
                'staked-available',
                'Available',
                '0',
                stakedFormatted.baseDenom.toUpperCase()
              )}
              {metricCard(
                'staked-delegated',
                'Delegated',
                stakedFormatted.formattedAmount,
                stakedFormatted.baseDenom.toUpperCase()
              )}
            </React.Fragment>
          )
        })()}
    </div>
  )
}
