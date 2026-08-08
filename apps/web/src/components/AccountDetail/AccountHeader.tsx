import React from 'react'
import { Link } from 'react-router-dom'
import { FiShield } from 'react-icons/fi'
import { useTheme } from '@/theme/ThemeProvider'
import type { AccountDetailResponse } from '@dexplorer/shared'
import Avatar from '@/components/ui/Avatar'
import CopyText from '@/components/ui/CopyText'

interface AccountHeaderProps {
  address: string
  account: AccountDetailResponse | null
}

export default function AccountHeader({
  address,
  account,
}: AccountHeaderProps) {
  const { colors } = useTheme()

  return (
    <div className="panel-surface flex flex-wrap items-center gap-[15px] px-6 py-5">
      <Avatar address={address} size={52} className="flex-shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className="text-[17px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Account
        </span>
        <CopyText
          text={address}
          className="flex-wrap text-[13px] [&_span]:break-all"
          style={{ color: colors.text.secondary }}
        />
        <span className="text-[11.5px]" style={{ color: colors.text.tertiary }}>
          Account #{account?.accountNumber ?? '—'} · Sequence{' '}
          {account?.sequence ?? '—'}
        </span>
        {account?.validator && (
          <Link
            to={`/validators/${encodeURIComponent(account.validator.identity || account.validator.moniker)}`}
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{
              backgroundColor: `${colors.primary}18`,
              color: colors.primary,
            }}
          >
            <FiShield className="h-3.5 w-3.5" />
            See validator profile ({account.validator.moniker})
          </Link>
        )}
      </div>
    </div>
  )
}
