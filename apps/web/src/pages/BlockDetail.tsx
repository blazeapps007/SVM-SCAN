import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiBox, FiChevronLeft, FiCopy } from 'react-icons/fi'
import { toast } from 'sonner'
import type {
  BlockDetailResponse,
  Coin,
  TransactionSummary,
} from '@dexplorer/shared'
import { formatCoinAmount } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useTheme } from '@/theme/ThemeProvider'
import { getTypeMsg, timeFromNow, trimHash } from '@/utils/helper'
import { getMessageTypePillStyle, getResultPillStyle } from '@/utils/pillStyle'

const TYPE_LABELS: Record<string, string> = {
  Transfer: 'IBC Transfer',
  WithdrawDelegatorReward: 'Withdraw Reward',
  Undelegate: 'Begin Unbonding',
}

const formatUtcTimestamp = (value: string | undefined) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC')
}

const formatFee = (coins: Coin[] | undefined) => {
  const fee = coins?.[0]
  if (!fee) return '—'
  return formatCoinAmount(fee.amount, fee.denom)
}

const formatGas = (value: number) => (value > 0 ? value.toLocaleString() : '—')

const BlockDetail: React.FC = () => {
  const { height } = useParams<{ height: string }>()
  const { colors } = useTheme()

  const blockQuery = useQuery({
    queryKey: ['block', height],
    queryFn: () => apiClient.get<BlockDetailResponse>(`/blocks/${height}`),
    enabled: Boolean(height),
  })

  const txsQuery = useQuery({
    queryKey: ['block', height, 'transactions'],
    queryFn: () =>
      apiClient.get<TransactionSummary[]>(`/blocks/${height}/transactions`),
    enabled: Boolean(height),
  })

  const block = blockQuery.data
  const loading = blockQuery.isLoading || txsQuery.isLoading

  const txRows = useMemo(
    () =>
      (txsQuery.data ?? []).map((tx) => {
        const rawType = tx.messageTypes[0]
          ? getTypeMsg(tx.messageTypes[0])
          : 'Unknown'

        return {
          fee: formatFee(tx.fee),
          gasUsed: Number(tx.gasUsed || 0),
          gasWanted: Number(tx.gasWanted || 0),
          hash: tx.hash,
          status: tx.success ? 'Success' : 'Failed',
          type: TYPE_LABELS[rawType] || rawType,
        }
      }),
    [txsQuery.data]
  )

  const details = useMemo(() => {
    if (!block) return null

    const proposer = block.proposerAddress || ''
    const gasUsed = txRows.reduce((sum, tx) => sum + tx.gasUsed, 0)
    const gasWanted = txRows.reduce((sum, tx) => sum + tx.gasWanted, 0)

    return {
      appHash: block.appHash?.toUpperCase() || '',
      blockHash: block.hash?.toUpperCase() || '—',
      proposer,
      proposerInitial: trimHash(proposer || 'NA', 2)
        .replace('.', '')
        .slice(0, 2),
      timestamp: formatUtcTimestamp(block.time),
      txCount: block.txCount,
      gasUsed,
      gasWanted,
    }
  }, [block, txRows])

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  if (loading) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>Loading block data...</p>
      </div>
    )
  }

  if (!block || !details) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>Block not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Link
        to="/blocks"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: colors.text.secondary }}
      >
        <FiChevronLeft className="h-4 w-4" />
        Back to blocks
      </Link>

      <div className="panel-surface rounded-[14px] px-6 py-[22px]">
        <div className="mb-[18px] flex flex-wrap items-center gap-[13px]">
          <div
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px]"
            style={{
              backgroundColor: `${colors.primary}14`,
              color: colors.primary,
            }}
          >
            <FiBox className="h-5 w-5" />
          </div>

          <div className="flex flex-col leading-[1.25]">
            <span
              className="text-[12px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: colors.text.tertiary }}
            >
              Block
            </span>
            <span
              className="font-mono text-[22px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {Number(height).toLocaleString()}
            </span>
          </div>

          <div className="flex-1" />

          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: `${colors.status.success}14`,
              border: `1px solid ${colors.status.success}30`,
              color: colors.status.success,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.status.success }}
            />
            Finalized
          </span>
        </div>

        <div
          className="grid gap-px overflow-hidden rounded-[11px] border md:grid-cols-2"
          style={{
            backgroundColor: colors.border.primary,
            borderColor: colors.border.primary,
          }}
        >
          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-center justify-between gap-4">
              <span
                className="text-[11.5px]"
                style={{ color: colors.text.tertiary }}
              >
                Block Hash
              </span>
              <button
                type="button"
                onClick={() => void copyText(details.blockHash, 'Block hash')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: colors.primary }}
              >
                <FiCopy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
            <span
              className="font-mono text-[13px] break-all"
              style={{ color: colors.text.primary }}
            >
              {details.blockHash}
            </span>
          </div>

          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              Timestamp
            </span>
            <span
              className="text-[13px]"
              style={{ color: colors.text.primary }}
            >
              {details.timestamp}
            </span>
          </div>

          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              Proposer
            </span>
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.65rem] font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                }}
              >
                {details.proposerInitial || 'NA'}
              </span>
              <span
                className="text-[13px]"
                style={{ color: colors.text.primary }}
              >
                {details.proposer ? trimHash(details.proposer, 14) : '—'}
              </span>
            </div>
          </div>

          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              Transactions
            </span>
            <span
              className="font-mono text-[13px]"
              style={{ color: colors.text.primary }}
            >
              {details.txCount}
            </span>
          </div>

          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              Gas (used / wanted)
            </span>
            <span
              className="font-mono text-[13px]"
              style={{ color: colors.text.primary }}
            >
              {formatGas(details.gasUsed)} / {formatGas(details.gasWanted)}
            </span>
          </div>

          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              App Hash
            </span>
            <span
              className="font-mono text-[13px] break-all"
              style={{ color: colors.text.primary }}
            >
              {details.appHash || '—'}
            </span>
          </div>
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
          Transactions in this block
        </div>

        <div
          className="hidden gap-3 border-b px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] md:grid md:grid-cols-[minmax(0,1.6fr)_130px_100px_110px]"
          style={{
            borderColor: colors.border.primary,
            color: colors.text.tertiary,
          }}
        >
          <span>Tx Hash</span>
          <span>Type</span>
          <span>Result</span>
          <span className="text-right">Fee</span>
        </div>

        {txRows.map((tx) => (
          <div
            key={tx.hash}
            className="reference-table-row grid gap-3 border-b px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_130px_100px_110px] md:items-center"
            style={{ borderColor: colors.border.primary }}
          >
            <Link
              to={`/txs/${tx.hash}`}
              className="truncate font-mono text-[12.5px]"
              style={{ color: colors.primary }}
            >
              {trimHash(tx.hash, 16)}
            </Link>
            <span
              className="reference-pill w-fit"
              style={getMessageTypePillStyle(tx.type, colors)}
            >
              {tx.type}
            </span>
            <span
              className="reference-pill w-fit"
              style={getResultPillStyle(tx.status === 'Success', colors)}
            >
              {tx.status}
            </span>
            <span
              className="font-mono text-[12.5px] md:text-right"
              style={{ color: colors.text.secondary }}
            >
              {tx.fee}
            </span>
          </div>
        ))}

        {txRows.length === 0 && (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: colors.text.secondary }}
          >
            No transactions in this block
          </div>
        )}
      </div>

      <div className="text-xs" style={{ color: colors.text.tertiary }}>
        Block time: {timeFromNow(block.time)}
      </div>
    </div>
  )
}

export default BlockDetail
