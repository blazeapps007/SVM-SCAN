import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiUser } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import { timeFromNow, getTypeMsg } from '@/utils/helper'
import type { RecentAccount } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import Avatar from '@/components/ui/Avatar'

const Accounts: React.FC = () => {
  const { colors } = useTheme()
  const navigate = useNavigate()

  const { data: recentAccounts = [], isLoading } = useQuery({
    queryKey: ['accounts', 'recent'],
    queryFn: () => apiClient.get<RecentAccount[]>('/accounts/recent?limit=10'),
    refetchInterval: 15_000,
  })

  const accounts = recentAccounts.map((account) => ({
    address: account.address,
    lastMessage: account.lastMessageType
      ? getTypeMsg(account.lastMessageType)
      : 'Unknown',
    lastActivity: timeFromNow(account.lastActivityTime),
  }))

  return (
    <div className="reference-table-shell">
      <div
        className="flex items-center justify-between border-b px-5 py-[15px]"
        style={{ borderColor: colors.border.primary }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: colors.text.primary }}
        >
          Recent Account Activity
        </span>
        <span className="text-xs" style={{ color: colors.text.tertiary }}>
          Select an account for details
        </span>
      </div>

      {accounts.length > 0 && (
        <div
          className="reference-table-header hidden gap-3 border-b px-5 py-3 md:grid md:grid-cols-[2fr_160px_110px]"
          style={{ borderColor: colors.border.primary }}
        >
          <span>Account</span>
          <span>Last Message</span>
          <span className="text-right">Last Active</span>
        </div>
      )}

      {accounts.map((account) => (
        <div
          key={account.address}
          role="button"
          tabIndex={0}
          className="reference-table-row grid cursor-pointer gap-3 border-b px-5 py-4 md:grid-cols-[2fr_160px_110px] md:items-center"
          style={{ borderColor: colors.border.primary }}
          onClick={() => navigate(`/accounts/${account.address}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navigate(`/accounts/${account.address}`)
            }
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar address={account.address} size={32} />
            <Link
              to={`/accounts/${account.address}`}
              className="truncate font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
              title={account.address}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              {account.address}
            </Link>
          </div>
          <span
            className="truncate text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            {account.lastMessage}
          </span>
          <span
            className="text-right text-xs"
            style={{ color: colors.text.tertiary }}
          >
            {account.lastActivity}
          </span>
        </div>
      ))}

      {accounts.length === 0 && !isLoading && (
        <div className="px-5 py-12 text-center">
          <FiUser
            className="mx-auto mb-4 h-12 w-12 opacity-50"
            style={{ color: colors.text.tertiary }}
          />
          <p style={{ color: colors.text.secondary }}>No accounts available</p>
          <p className="mt-1 text-sm" style={{ color: colors.text.tertiary }}>
            Account information will appear here
          </p>
        </div>
      )}
    </div>
  )
}

export default Accounts
