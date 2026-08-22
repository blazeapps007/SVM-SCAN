import React, { useMemo, useState } from 'react'
import { useTheme } from '@/theme/ThemeProvider'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiMenu, FiMoon, FiSearch, FiSun } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { useApiHealth } from '@/hooks/useApiHealth'
import { toast } from 'sonner'

interface TopNavigationProps {
  onMenuClick?: () => void
}

const getPageMeta = (pathname: string) => {
  if (pathname === '/') {
    return {
      title: 'Network Overview',
      subtitle: 'Real-time chain activity',
    }
  }

  if (pathname === '/blocks') {
    return { title: 'Blocks', subtitle: 'Latest blocks produced on chain' }
  }

  if (pathname.startsWith('/blocks/')) {
    return { title: 'Block', subtitle: 'Block details and transactions' }
  }

  if (pathname === '/txs') {
    return {
      title: 'Transactions',
      subtitle: 'Recent transactions across the chain',
    }
  }

  if (pathname.startsWith('/tx/')) {
    return {
      title: 'Transaction',
      subtitle: 'Transaction details and messages',
    }
  }

  if (pathname === '/accounts') {
    return { title: 'Accounts', subtitle: 'Recent account activity' }
  }

  if (pathname.startsWith('/accounts/')) {
    return { title: 'Account', subtitle: 'Balances, activity, and holdings' }
  }

  if (pathname === '/validators') {
    return { title: 'Validators', subtitle: 'Active validator set' }
  }

  if (pathname.startsWith('/validators/')) {
    return { title: 'Validator', subtitle: 'Validator metadata and status' }
  }

  if (pathname === '/proposals') {
    return { title: 'Governance', subtitle: 'On-chain proposals and voting' }
  }

  if (pathname.startsWith('/proposals/')) {
    return { title: 'Proposal', subtitle: 'Governance proposal details' }
  }

  if (pathname === '/ibc-transfers') {
    return { title: 'IBC Transfers', subtitle: 'Cross-chain token transfers' }
  }

  if (pathname === '/liquidity-pools') {
    return {
      title: 'Liquidity Pools',
      subtitle: 'EVM pools created on-chain',
    }
  }

  if (pathname === '/parameters') {
    return {
      title: 'Chain Parameters',
      subtitle: 'Module configuration values',
    }
  }

  return { title: 'SVM Scan', subtitle: 'Steem Virtual Machine Explorer' }
}

const TopNavigation: React.FC<TopNavigationProps> = ({ onMenuClick }) => {
  const { colors, colorScheme, toggleColorScheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { isHealthy } = useApiHealth()

  const [searchQuery, setSearchQuery] = useState('')

  const meta = useMemo(
    () => getPageMeta(location.pathname),
    [location.pathname]
  )

  const heightRegex = /^\d+$/
  const txhashRegex = /^[A-Za-z\d]{64}$/
  const addrRegex = /^[a-z\d]+1[a-z\d]{38,58}$/

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    if (!searchQuery.trim()) return

    if (heightRegex.test(searchQuery)) {
      navigate(`/blocks/${searchQuery}`)
    } else if (txhashRegex.test(searchQuery)) {
      navigate(`/tx/${searchQuery}`)
    } else if (addrRegex.test(searchQuery)) {
      navigate(`/accounts/${searchQuery}`)
    } else {
      toast.error('Invalid search query format')
    }

    setSearchQuery('')
  }

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        backgroundColor:
          colorScheme === 'dark'
            ? 'rgba(7, 9, 13, 0.88)'
            : 'rgba(244, 247, 251, 0.88)',
        borderColor: colors.border.primary,
      }}
    >
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
        <Button
          onClick={onMenuClick}
          variant="ghost"
          size="sm"
          aria-label="Open menu"
          className="lg:hidden"
          style={{ color: colors.text.primary }}
        >
          <FiMenu className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          <h1
            className="truncate font-heading text-[1.45rem] font-semibold leading-none"
            style={{ color: colors.text.primary }}
          >
            {meta.title}
          </h1>
          <div className="mt-1 text-sm" style={{ color: colors.text.tertiary }}>
            {meta.subtitle}
          </div>
        </div>

        <div className="ml-auto flex min-w-[170px] flex-1 flex-wrap items-center justify-end gap-3 sm:min-w-0">
          <form
            onSubmit={handleSearch}
            className="order-last w-full max-w-full flex-1 basis-full sm:order-none sm:w-auto sm:max-w-[420px] sm:basis-auto md:min-w-[280px]"
          >
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: colors.text.tertiary }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search address / tx / block..."
                aria-label="Search address, transaction, or block"
                className="shell-input h-10 w-full rounded-[14px] py-2 pl-11 pr-4 text-sm outline-none transition-all duration-200 focus:ring-2"
                style={{
                  borderColor: colors.border.primary,
                  backgroundColor: colors.surface,
                  color: colors.text.primary,
                  boxShadow: `0 0 0 0 transparent`,
                }}
                onFocus={(event) => {
                  event.currentTarget.style.boxShadow = `0 0 0 4px ${colors.primary}1f`
                  event.currentTarget.style.borderColor = `${colors.primary}66`
                }}
                onBlur={(event) => {
                  event.currentTarget.style.boxShadow = '0 0 0 0 transparent'
                  event.currentTarget.style.borderColor = colors.border.primary
                }}
              />
            </div>
          </form>

          <Button
            onClick={toggleColorScheme}
            variant="secondary"
            size="sm"
            aria-label={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
            className="h-10 w-10 rounded-[14px] p-0"
          >
            {colorScheme === 'dark' ? (
              <FiSun className="h-4 w-4" />
            ) : (
              <FiMoon className="h-4 w-4" />
            )}
          </Button>

          <div
            className="flex min-h-10 items-center gap-2 rounded-[14px] border px-3 py-2.5 text-sm font-semibold sm:px-4"
            style={{
              borderColor: isHealthy
                ? `${colors.status.success}88`
                : `${colors.status.error}88`,
              backgroundColor: isHealthy
                ? `${colors.status.success}14`
                : `${colors.status.error}12`,
              color: isHealthy ? colors.status.success : colors.status.error,
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: isHealthy
                  ? colors.status.success
                  : colors.status.error,
              }}
            />
            <span className="hidden sm:inline">
              {isHealthy ? 'Connected' : 'API unreachable'}
            </span>
            <span className="sr-only sm:hidden">
              {isHealthy ? 'Connected' : 'API unreachable'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNavigation
