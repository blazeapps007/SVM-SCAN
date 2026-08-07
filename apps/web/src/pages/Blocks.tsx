import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiHash } from 'react-icons/fi'
import type { BlockSummary, Paginated } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useTheme } from '@/theme/ThemeProvider'
import { timeFromNow, trimHash } from '@/utils/helper'
import CopyText from '@/components/ui/CopyText'

const Blocks: React.FC = () => {
  const { colors } = useTheme()

  const { data, isLoading } = useQuery({
    queryKey: ['blocks', 'list'],
    queryFn: () => apiClient.get<Paginated<BlockSummary>>('/blocks?perPage=50'),
    refetchInterval: 6000,
  })

  const blocks = data?.data ?? []

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
                  Height
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Block Hash
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Proposer
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Txns
                </th>
                <th className="reference-table-header px-5 py-4 text-left">
                  Gas
                </th>
                <th className="reference-table-header px-5 py-4 text-right">
                  Age
                </th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => {
                const proposerDisplay = trimHash(block.proposerAddress || '', 8)

                return (
                  <tr
                    key={block.height}
                    className="reference-table-row border-b"
                    style={{ borderColor: colors.border.primary }}
                  >
                    <td className="px-5 py-4">
                      <Link
                        to={`/blocks/${block.height}`}
                        className="font-mono text-[1.05rem] font-semibold hover:opacity-70 transition-opacity"
                        style={{ color: colors.primary }}
                      >
                        {block.height.toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <CopyText
                        text={block.hash}
                        displayText={trimHash(block.hash, 16)}
                        className="text-sm"
                        style={{ color: colors.text.secondary }}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.65rem] font-semibold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                          }}
                        >
                          {proposerDisplay.charAt(0) || '?'}
                        </div>
                        <span
                          className="text-sm"
                          style={{ color: colors.text.secondary }}
                        >
                          {proposerDisplay}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span style={{ color: colors.text.primary }}>
                        {block.txCount}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-sm"
                      style={{ color: colors.text.tertiary }}
                    >
                      --
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className="text-sm"
                        style={{ color: colors.text.secondary }}
                      >
                        {timeFromNow(block.time)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!isLoading && blocks.length === 0 && (
            <div className="py-12 text-center">
              <FiHash
                className="mx-auto mb-4 h-12 w-12 opacity-50"
                style={{ color: colors.text.tertiary }}
              />
              <p style={{ color: colors.text.secondary }}>
                No blocks available
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: colors.text.tertiary }}
              >
                Blocks will appear here once the indexer catches up
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Blocks
