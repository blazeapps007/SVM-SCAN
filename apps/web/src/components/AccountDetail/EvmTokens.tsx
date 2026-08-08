import React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AddressTokenHolding } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useTheme } from '@/theme/ThemeProvider'
import { formatTokenAmount, trimHash } from '@/utils/helper'

interface EvmTokensProps {
  address: string
}

const NFT_TYPES = new Set(['ERC-721', 'ERC-1155'])

export default function EvmTokens({ address }: EvmTokensProps) {
  const { colors } = useTheme()

  // Supplementary to the account page (source is the chain's own Blockscout
  // instance, not the chain itself) — fetched independently so it never
  // blocks or fails the primary balance/staked data above it.
  const { data: tokens } = useQuery({
    queryKey: ['account-evm-tokens', address],
    queryFn: () =>
      apiClient.get<AddressTokenHolding[]>(`/evm/address/${address}/tokens`),
    enabled: Boolean(address),
    retry: false,
  })

  if (!tokens || tokens.length === 0) return null

  const fungibleTokens = tokens.filter((t) => !NFT_TYPES.has(t.tokenType))
  const nftCollections = tokens.filter((t) => NFT_TYPES.has(t.tokenType))

  return (
    <div className="panel-surface px-6 py-5">
      <h2
        className="mb-4 text-[14px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        EVM Tokens
      </h2>

      <div className="flex flex-col gap-5">
        {fungibleTokens.length > 0 && (
          <div className="flex flex-col gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: colors.text.tertiary }}
            >
              ERC-20 Tokens ({fungibleTokens.length})
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fungibleTokens.map((token) => (
                <div
                  key={token.tokenAddress}
                  className="flex flex-col gap-1 rounded-[11px] border px-[16px] py-[12px]"
                  style={{ borderColor: colors.border.secondary }}
                >
                  <span
                    className="font-mono text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {formatTokenAmount(
                      token.value,
                      token.decimals,
                      token.symbol
                    )}
                  </span>
                  <span
                    className="truncate text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                    title={token.name ?? undefined}
                  >
                    {token.name || trimHash(token.tokenAddress, 10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nftCollections.length > 0 && (
          <div className="flex flex-col gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: colors.text.tertiary }}
            >
              NFTs ({nftCollections.length})
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nftCollections.map((token) => (
                <div
                  key={token.tokenAddress}
                  className="flex flex-col gap-1 rounded-[11px] border px-[16px] py-[12px]"
                  style={{ borderColor: colors.border.secondary }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                      title={token.name ?? undefined}
                    >
                      {token.name || trimHash(token.tokenAddress, 10)}
                    </span>
                    <span
                      className="reference-pill shrink-0"
                      style={{
                        backgroundColor: `${colors.primary}20`,
                        color: colors.primary,
                      }}
                    >
                      {token.tokenType}
                    </span>
                  </div>
                  <span
                    className="text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    {token.value} owned
                    {token.symbol ? ` · ${token.symbol}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
