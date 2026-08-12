import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiActivity, FiArrowRight, FiChevronLeft, FiCopy } from 'react-icons/fi'
import { toast } from 'sonner'
import type {
  Coin,
  EvmTransactionDetails,
  TransactionDetailResponse,
} from '@dexplorer/shared'
import { formatCoinAmount } from '@dexplorer/shared'
import { apiClient } from '@/lib/apiClient'
import { useTheme } from '@/theme/ThemeProvider'
import {
  convertRateToPercent,
  formatTokenAmount,
  getTypeMsg,
  isBech32Address,
  parseDetailsLines,
  safeStringify,
  trimHash,
} from '@/utils/helper'
import { getMessageTypePillStyle, getResultPillStyle } from '@/utils/pillStyle'

const VALIDATOR_MESSAGE_TYPES = new Set([
  '/cosmos.staking.v1beta1.MsgCreateValidator',
  '/cosmos.staking.v1beta1.MsgEditValidator',
])

interface ValidatorMessageData {
  description?: {
    moniker?: string
    identity?: string
    website?: string
    securityContact?: string
    details?: string
  }
  commission?: {
    rate?: string
    maxRate?: string
    maxChangeRate?: string
  }
  minSelfDelegation?: string
  validatorAddress?: string
  value?: { denom: string; amount: string }
}

const TYPE_LABELS: Record<string, string> = {
  Transfer: 'IBC Transfer',
  RecvPacket: 'IBC Receive',
  Acknowledgement: 'IBC Acknowledge',
  SubmitSteemDeposit: 'Submit Steem Deposit',
  BridgeOut: 'Bridge Out (Withdrawal)',
  Timeout: 'IBC Timeout',
  WithdrawDelegatorReward: 'Withdraw Reward',
  Undelegate: 'Begin Unbonding',
  EthereumTx: 'Contract Call',
}

const TOKEN_TRANSFER_TYPE_LABELS: Record<string, string> = {
  token_minting: 'Mint',
  token_transfer: 'Transfer',
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

const formatGas = (value: string | undefined) => {
  const num = Number(value || 0)
  return num > 0 ? num.toLocaleString() : '—'
}

const stringifyField = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)

  try {
    return safeStringify(value)
  } catch {
    return String(value)
  }
}

const TransactionDetail: React.FC = () => {
  const { hash } = useParams<{ hash: string }>()
  const { colors } = useTheme()

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', hash],
    queryFn: () =>
      apiClient.get<TransactionDetailResponse>(`/transactions/${hash}`),
    enabled: Boolean(hash),
  })

  const evmTxHash = useMemo(() => {
    const ethMessage = tx?.messages.find(
      (m) => m.typeUrl === '/cosmos.evm.vm.v1.MsgEthereumTx'
    )
    const data = ethMessage?.data as { hash?: string } | undefined
    return data?.hash || null
  }, [tx])

  const { data: evmDetails, isLoading: isEvmLoading } = useQuery({
    queryKey: ['evm-transaction', evmTxHash],
    queryFn: () => apiClient.get<EvmTransactionDetails>(`/evm/tx/${evmTxHash}`),
    enabled: Boolean(evmTxHash),
    retry: false,
  })

  const validatorMessage = useMemo(() => {
    const message = tx?.messages.find((m) =>
      VALIDATOR_MESSAGE_TYPES.has(m.typeUrl)
    )
    return (message?.data as ValidatorMessageData | undefined) ?? null
  }, [tx])

  const validatorDetailsLines = useMemo(
    () =>
      validatorMessage?.description?.details
        ? parseDetailsLines(validatorMessage.description.details)
        : null,
    [validatorMessage]
  )

  const txMeta = useMemo(() => {
    if (!tx) return null

    // Relayed IBC txs bundle a housekeeping MsgUpdateClient alongside the
    // message that actually matters (RecvPacket/Acknowledgement/Timeout) —
    // prefer that one for the headline type instead of always showing
    // whichever message happens to be first.
    const primaryTypeUrl =
      tx.messageTypes.find((typeUrl) => !typeUrl.endsWith('MsgUpdateClient')) ??
      tx.messageTypes[0]
    const rawType = primaryTypeUrl ? getTypeMsg(primaryTypeUrl) : 'Unknown'

    return {
      fee: formatFee(tx.fee),
      gasUsed: formatGas(tx.gasUsed),
      gasWanted: formatGas(tx.gasWanted),
      memo: tx.memo || '—',
      status: tx.success ? 'Success' : 'Failed',
      type: TYPE_LABELS[rawType] || rawType,
    }
  }, [tx])

  const messageRows = useMemo(() => {
    if (!tx?.messages.length) return []

    return tx.messages.map((message) => {
      const fields = Object.entries(
        (message.data as Record<string, unknown>) || {}
      ).map(([key, value]) => ({
        key,
        value,
      }))

      return {
        fields,
        type: getTypeMsg(message.typeUrl),
        typeUrl: message.typeUrl,
      }
    })
  }, [tx])

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>
          Loading transaction data...
        </p>
      </div>
    )
  }

  if (!tx || !txMeta) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>Transaction not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Link
        to="/txs"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: colors.text.secondary }}
      >
        <FiChevronLeft className="h-4 w-4" />
        Back to transactions
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
            <FiActivity className="h-5 w-5" />
          </div>

          <div className="flex flex-col gap-[5px] leading-[1.2]">
            <span
              className="text-[12px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: colors.text.tertiary }}
            >
              Transaction
            </span>
            <div>
              <span
                className="reference-pill"
                style={getMessageTypePillStyle(txMeta.type, colors)}
              >
                {txMeta.type}
              </span>
            </div>
          </div>

          <div className="flex-1" />

          <span
            className="reference-pill"
            style={getResultPillStyle(txMeta.status === 'Success', colors)}
          >
            {txMeta.status}
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
            className="flex flex-col gap-1 px-[18px] py-[14px] md:col-span-2"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-center justify-between gap-4">
              <span
                className="text-[11.5px]"
                style={{ color: colors.text.tertiary }}
              >
                Transaction Hash
              </span>
              <button
                type="button"
                onClick={() => void copyText(tx.hash, 'Transaction hash')}
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
              {tx.hash.toUpperCase()}
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
              Height
            </span>
            <Link
              to={`/blocks/${tx.height}`}
              className="font-mono text-[13px]"
              style={{ color: colors.primary }}
            >
              {Number(tx.height).toLocaleString()}
            </Link>
          </div>

          <div
            className="flex flex-col gap-1 px-[18px] py-[14px]"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              Chain ID
            </span>
            <span
              className="font-mono text-[13px]"
              style={{ color: colors.text.primary }}
            >
              {tx.chainId || '—'}
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
              Time
            </span>
            <span
              className="text-[13px]"
              style={{ color: colors.text.primary }}
            >
              {formatUtcTimestamp(tx.timestamp)}
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
              Fee
            </span>
            <span
              className="font-mono text-[13px]"
              style={{ color: colors.text.primary }}
            >
              {txMeta.fee}
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
              {txMeta.gasUsed} / {txMeta.gasWanted}
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
              Memo
            </span>
            <span
              className="text-[13px]"
              style={{ color: colors.text.tertiary }}
            >
              {txMeta.memo}
            </span>
          </div>
        </div>
      </div>

      {tx.ibcTransfer && (
        <div className="reference-table-shell rounded-[14px]">
          <div
            className="border-b px-5 py-[15px] text-[14px] font-semibold"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          >
            IBC Transfer
          </div>

          <div className="flex flex-col gap-[14px] px-5 py-[18px]">
            <div className="flex flex-wrap items-center gap-3">
              {isBech32Address(tx.ibcTransfer.sender) ? (
                <Link
                  to={`/accounts/${tx.ibcTransfer.sender}`}
                  className="break-all font-mono text-[12.5px]"
                  style={{ color: colors.primary }}
                >
                  {tx.ibcTransfer.sender}
                </Link>
              ) : (
                <span
                  className="break-all font-mono text-[12.5px]"
                  style={{ color: colors.text.primary }}
                >
                  {tx.ibcTransfer.sender || '—'}
                </span>
              )}
              <FiArrowRight
                className="h-4 w-4 shrink-0"
                style={{ color: colors.text.tertiary }}
              />
              {isBech32Address(tx.ibcTransfer.receiver) ? (
                <Link
                  to={`/accounts/${tx.ibcTransfer.receiver}`}
                  className="break-all font-mono text-[12.5px]"
                  style={{ color: colors.primary }}
                >
                  {tx.ibcTransfer.receiver}
                </Link>
              ) : (
                <span
                  className="break-all font-mono text-[12.5px]"
                  style={{ color: colors.text.primary }}
                >
                  {tx.ibcTransfer.receiver || '—'}
                </span>
              )}
            </div>

            <div
              className="grid gap-px overflow-hidden rounded-[11px] border sm:grid-cols-2"
              style={{
                backgroundColor: colors.border.primary,
                borderColor: colors.border.primary,
              }}
            >
              <div
                className="flex flex-col gap-1 px-[16px] py-[12px]"
                style={{ backgroundColor: colors.surface }}
              >
                <span
                  className="text-[11.5px]"
                  style={{ color: colors.text.tertiary }}
                >
                  Amount
                </span>
                <span
                  className="font-mono text-[13px]"
                  style={{ color: colors.text.primary }}
                >
                  {formatCoinAmount(
                    tx.ibcTransfer.amount,
                    tx.ibcTransfer.denom
                  )}
                </span>
              </div>
              <div
                className="flex flex-col gap-1 px-[16px] py-[12px]"
                style={{ backgroundColor: colors.surface }}
              >
                <span
                  className="text-[11.5px]"
                  style={{ color: colors.text.tertiary }}
                >
                  Source
                </span>
                <span
                  className="font-mono text-[13px]"
                  style={{ color: colors.text.primary }}
                >
                  {tx.ibcTransfer.sourcePort}/
                  {tx.ibcTransfer.sourceChannel || '—'}
                </span>
              </div>
              <div
                className="flex flex-col gap-1 px-[16px] py-[12px] sm:col-span-2"
                style={{ backgroundColor: colors.surface }}
              >
                <span
                  className="text-[11.5px]"
                  style={{ color: colors.text.tertiary }}
                >
                  Destination
                </span>
                <span
                  className="font-mono text-[13px]"
                  style={{ color: colors.text.primary }}
                >
                  {tx.ibcTransfer.destinationPort}/
                  {tx.ibcTransfer.destinationChannel || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {evmTxHash && (isEvmLoading || evmDetails) && (
        <div className="reference-table-shell rounded-[14px]">
          <div
            className="border-b px-5 py-[15px] text-[14px] font-semibold"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          >
            EVM Execution
          </div>

          {!evmDetails ? (
            <div
              className="px-5 py-[18px] text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Loading EVM execution details...
            </div>
          ) : (
            <div className="flex flex-col gap-[16px] px-5 py-[18px]">
              <div className="flex flex-wrap items-center gap-[10px]">
                {evmDetails.method && (
                  <span
                    className="reference-pill"
                    style={getMessageTypePillStyle(evmDetails.method, colors)}
                  >
                    {evmDetails.method}
                  </span>
                )}
                <span
                  className="reference-pill"
                  style={getResultPillStyle(evmDetails.status === 'ok', colors)}
                >
                  {evmDetails.status === 'ok' ? 'Success' : 'Failed'}
                </span>
              </div>

              {evmDetails.to && (
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    {evmDetails.toIsContract
                      ? 'Interacted With (Contract)'
                      : 'To'}
                  </span>
                  <span
                    className="break-all font-mono text-[12.5px]"
                    style={{ color: colors.text.primary }}
                  >
                    {evmDetails.to}
                  </span>
                </div>
              )}

              {evmDetails.tokenTransfers.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span
                    className="text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    Tokens Transferred ({evmDetails.tokenTransfers.length})
                  </span>
                  <div className="flex flex-col gap-2">
                    {evmDetails.tokenTransfers.map((transfer, index) => (
                      <div
                        key={`${transfer.tokenAddress}-${index}`}
                        className="flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2"
                        style={{ borderColor: colors.border.primary }}
                      >
                        <span
                          className="reference-pill"
                          style={getMessageTypePillStyle(transfer.type, colors)}
                        >
                          {TOKEN_TRANSFER_TYPE_LABELS[transfer.type] ||
                            'Transfer'}
                        </span>
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: colors.text.secondary }}
                          title={transfer.from}
                        >
                          {trimHash(transfer.from, 10)}
                        </span>
                        <FiArrowRight
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: colors.text.tertiary }}
                        />
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: colors.text.secondary }}
                          title={transfer.to}
                        >
                          {trimHash(transfer.to, 10)}
                        </span>
                        <span
                          className="ml-auto font-mono text-[12.5px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {formatTokenAmount(
                            transfer.amount,
                            transfer.tokenDecimals,
                            transfer.tokenSymbol
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evmDetails.explorerUrl && (
                <a
                  href={evmDetails.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] font-medium hover:underline"
                  style={{ color: colors.primary }}
                >
                  View full EVM trace on Blockscout →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {validatorMessage && (
        <div className="reference-table-shell rounded-[14px]">
          <div
            className="border-b px-5 py-[15px] text-[14px] font-semibold"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          >
            Validator Details
          </div>

          <div className="flex flex-col gap-[14px] px-5 py-[18px]">
            <div className="flex flex-wrap items-center gap-[10px]">
              {validatorMessage.description?.moniker && (
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {validatorMessage.description.moniker}
                </span>
              )}
              {validatorMessage.description?.website && (
                <a
                  href={validatorMessage.description.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] hover:underline"
                  style={{ color: colors.primary }}
                >
                  {validatorMessage.description.website}
                </a>
              )}
            </div>

            {validatorDetailsLines ? (
              <div className="flex flex-col gap-1">
                {validatorDetailsLines.map(({ key, value }) => (
                  <p
                    key={key}
                    className="break-all text-[12.5px] leading-[1.6]"
                    style={{ color: colors.text.secondary }}
                  >
                    <span
                      className="font-semibold capitalize"
                      style={{ color: colors.text.primary }}
                    >
                      {key}:
                    </span>{' '}
                    <span className="font-mono text-[12px]">{value}</span>
                  </p>
                ))}
              </div>
            ) : (
              validatorMessage.description?.details && (
                <p
                  className="text-[13px] leading-[1.55]"
                  style={{ color: colors.text.secondary }}
                >
                  {validatorMessage.description.details}
                </p>
              )
            )}

            <div
              className="grid gap-px overflow-hidden rounded-[11px] border sm:grid-cols-2"
              style={{
                backgroundColor: colors.border.primary,
                borderColor: colors.border.primary,
              }}
            >
              {validatorMessage.commission && (
                <>
                  <div
                    className="flex flex-col gap-1 px-[16px] py-[12px]"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <span
                      className="text-[11.5px]"
                      style={{ color: colors.text.tertiary }}
                    >
                      Commission Rate
                    </span>
                    <span
                      className="font-mono text-[13px]"
                      style={{ color: colors.text.primary }}
                    >
                      {convertRateToPercent(validatorMessage.commission.rate) ||
                        '—'}
                    </span>
                  </div>
                  <div
                    className="flex flex-col gap-1 px-[16px] py-[12px]"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <span
                      className="text-[11.5px]"
                      style={{ color: colors.text.tertiary }}
                    >
                      Max Rate / Max Change
                    </span>
                    <span
                      className="font-mono text-[13px]"
                      style={{ color: colors.text.primary }}
                    >
                      {convertRateToPercent(
                        validatorMessage.commission.maxRate
                      ) || '—'}{' '}
                      /{' '}
                      {convertRateToPercent(
                        validatorMessage.commission.maxChangeRate
                      ) || '—'}
                    </span>
                  </div>
                </>
              )}
              {validatorMessage.minSelfDelegation && (
                <div
                  className="flex flex-col gap-1 px-[16px] py-[12px]"
                  style={{ backgroundColor: colors.surface }}
                >
                  <span
                    className="text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    Min Self Delegation
                  </span>
                  <span
                    className="font-mono text-[13px]"
                    style={{ color: colors.text.primary }}
                  >
                    {validatorMessage.minSelfDelegation}
                  </span>
                </div>
              )}
              {validatorMessage.value && (
                <div
                  className="flex flex-col gap-1 px-[16px] py-[12px]"
                  style={{ backgroundColor: colors.surface }}
                >
                  <span
                    className="text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    Self Bond
                  </span>
                  <span
                    className="font-mono text-[13px]"
                    style={{ color: colors.text.primary }}
                  >
                    {formatCoinAmount(
                      validatorMessage.value.amount,
                      validatorMessage.value.denom
                    )}
                  </span>
                </div>
              )}
              {validatorMessage.validatorAddress && (
                <div
                  className="flex flex-col gap-1 px-[16px] py-[12px] sm:col-span-2"
                  style={{ backgroundColor: colors.surface }}
                >
                  <span
                    className="text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    Validator Address
                  </span>
                  <Link
                    to={`/validators/${encodeURIComponent(validatorMessage.validatorAddress)}`}
                    className="break-all font-mono text-[12.5px]"
                    style={{ color: colors.primary }}
                  >
                    {validatorMessage.validatorAddress}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="reference-table-shell rounded-[14px]">
        <div
          className="border-b px-5 py-[15px] text-[14px] font-semibold"
          style={{
            borderColor: colors.border.primary,
            color: colors.text.primary,
          }}
        >
          Messages ({messageRows.length})
        </div>

        <div className="px-5 py-[18px]">
          <div
            className="rounded-[11px] border px-[18px] py-4"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border.primary,
            }}
          >
            {messageRows.map((message, messageIndex) => (
              <div key={`${message.typeUrl}-${messageIndex}`}>
                <div className="mb-2 flex flex-wrap items-center gap-[10px]">
                  <span
                    className="reference-pill"
                    style={getMessageTypePillStyle(message.type, colors)}
                  >
                    {message.type}
                  </span>
                  <span
                    className="font-mono text-[11.5px]"
                    style={{ color: colors.text.tertiary }}
                  >
                    {message.typeUrl}
                  </span>
                </div>

                {message.fields.map((field, fieldIndex) => (
                  <div
                    key={`${field.key}-${fieldIndex}`}
                    className="flex flex-col justify-between gap-2 border-t py-[9px] md:flex-row md:items-start md:gap-[18px]"
                    style={{ borderColor: colors.border.primary }}
                  >
                    <span
                      className="text-[12.5px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {field.key}
                    </span>
                    <div
                      className="font-mono text-[12.5px] break-all md:max-w-[70%] md:text-right"
                      style={{ color: colors.text.primary }}
                    >
                      {typeof field.value === 'string' &&
                      isBech32Address(field.value) ? (
                        <Link
                          to={`/accounts/${field.value}`}
                          style={{ color: colors.primary }}
                        >
                          {field.value}
                        </Link>
                      ) : (
                        stringifyField(field.value)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {messageRows.length === 0 && (
              <div className="text-sm" style={{ color: colors.text.secondary }}>
                No decoded messages available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TransactionDetail
