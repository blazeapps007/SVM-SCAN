import React, { useState } from 'react'
import { useTheme } from '@/theme/ThemeProvider'
import BridgeDeposits from '@/pages/BridgeDeposits'
import BridgeWithdrawals from '@/pages/BridgeWithdrawals'

type BridgeTab = 'deposits' | 'withdrawals'

const TABS: { label: string; value: BridgeTab }[] = [
  { label: 'Deposits', value: 'deposits' },
  { label: 'Withdrawals', value: 'withdrawals' },
]

const Bridge: React.FC = () => {
  const { colors } = useTheme()
  const [tab, setTab] = useState<BridgeTab>('deposits')

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b" style={{ borderColor: colors.border.primary }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className="px-4 py-3 text-sm font-semibold transition-opacity"
            style={{
              color: tab === t.value ? colors.primary : colors.text.tertiary,
              borderBottom:
                tab === t.value
                  ? `2px solid ${colors.primary}`
                  : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'deposits' ? <BridgeDeposits /> : <BridgeWithdrawals />}
    </div>
  )
}

export default Bridge
