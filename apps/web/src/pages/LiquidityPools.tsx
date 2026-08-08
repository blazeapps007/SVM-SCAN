import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiDroplet } from 'react-icons/fi'
import type {
  LiquidityPoolSummary,
  LiquidityPoolTokenInfo,
  Paginated,
} from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useTheme } from '@/theme/ThemeProvider'
import { trimHash, timeFromNow } from '@/utils/helper'
import CopyText from '@/components/ui/CopyText'

const PER_PAGE = 25

const tokenLabel = (token: LiquidityPoolTokenInfo): string =>
  token.symbol || trimHash(token.address, 10)

const formatFee = (fee: string): string => {
  const num = Number(fee)
  if (!Number.isFinite(num)) return '—'
  // Uniswap V3-style fee is in hundredths of a basis point (1e-6), e.g.
  // 2500 -> 0.25%.
  return `${(num / 10000).toFixed(2)}%`
}

const LiquidityPools: React.FC = () => {
  const { colors } = useTheme()
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['liquidity-pools', page],
    queryFn: () =>
      apiClient.get<Paginated<LiquidityPoolSummary>>(
        `/liquidity-pools?page=${page}&perPage=${PER_PAGE}`
      ),
    refetchInterval: 15_000,
  })

  const pools = data?.data ?? []
  const total = data?.pagination.total ?? 0

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
                  Pair
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Fee
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Pool Address
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Created
                </th>
                <th className="reference-table-header px-5 py-4 text-right">
                  Age
                </th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => (
                <tr
                  key={pool.poolAddress}
                  className="reference-table-row border-b"
                  style={{ borderColor: colors.border.primary }}
                >
                  <td className="px-5 py-4">
                    <span
                      className="font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {tokenLabel(pool.token0)} / {tokenLabel(pool.token1)}
                    </span>
                    <div
                      className="mt-1 flex flex-col gap-0.5 font-mono text-[11px]"
                      style={{ color: colors.text.tertiary }}
                    >
                      <span title={pool.token0.name ?? undefined}>
                        {trimHash(pool.token0.address, 10)}
                      </span>
                      <span title={pool.token1.name ?? undefined}>
                        {trimHash(pool.token1.address, 10)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="reference-pill"
                      style={{
                        backgroundColor: `${colors.primary}18`,
                        color: colors.primary,
                      }}
                    >
                      {formatFee(pool.fee)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <CopyText
                      text={pool.poolAddress}
                      displayText={trimHash(pool.poolAddress, 12)}
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      to={`/blocks/${pool.createdAtHeight}`}
                      className="font-mono hover:opacity-70 transition-opacity"
                      style={{ color: colors.primary }}
                    >
                      {pool.createdAtHeight.toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {timeFromNow(pool.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLoading && pools.length === 0 && (
            <div className="py-12 text-center">
              <FiDroplet
                className="mx-auto mb-4 h-12 w-12 opacity-50"
                style={{ color: colors.text.tertiary }}
              />
              <p style={{ color: colors.text.secondary }}>
                No liquidity pools yet
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: colors.text.tertiary }}
              >
                Newly created pools will appear here once the indexer catches
                up
              </p>
            </div>
          )}
        </div>

        {total > PER_PAGE && (
          <div
            className="flex items-center justify-between border-t px-5 py-[14px]"
            style={{ borderColor: colors.border.primary }}
          >
            <span className="text-xs" style={{ color: colors.text.tertiary }}>
              Showing {page * PER_PAGE + 1}–
              {Math.min((page + 1) * PER_PAGE, total)} of {total} pools
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-[8px] border px-[13px] py-[7px] text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border.primary,
                  color: colors.text.tertiary,
                }}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={(page + 1) * PER_PAGE >= total}
                onClick={() => setPage(page + 1)}
                className="rounded-[8px] border px-[13px] py-[7px] text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: `${colors.primary}18`,
                  borderColor: `${colors.primary}66`,
                  color: colors.primary,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LiquidityPools
