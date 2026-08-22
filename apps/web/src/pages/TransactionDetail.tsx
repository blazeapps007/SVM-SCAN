import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiActivity, FiArrowRight, FiChevronLeft, FiCopy } from 'react-icons/fi'
import { toast } from 'sonner'
import type {
  Coin,
  EvmTransactionDetails,
  ExchangeRateVoteEntry,
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
  parseCoinString,
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
  AttestDeposit: 'Attest Deposit',
  BridgeOut: 'Bridge Out (Withdrawal)',
  SubmitNameRegistration: 'Submit Name Registration',
  ConfirmName: 'Confirm Name',
  AttestWithdrawalPayout: 'Attest Withdrawal Payout',
  AggregateExchangeRateVote: 'Oracle Vote',
  AggregateExchangeRatePrevote: 'Oracle Prevote',
  GrantAllowance: 'Grant Fee Allowance',
  RevokeAllowance: 'Revoke Fee Allowance',
  Timeout: 'IBC Timeout',
  WithdrawDelegatorReward: 'Withdraw Reward',
  Undelegate: 'Begin Unbonding',
  // EthereumTx deliberately isn't listed here — every MsgEthereumTx got
  // labeled "Contract Call" regardless of what it actually did, which was
  // wrong for a plain native-value transfer (no contract involved at all).
  // See getEvmTxKindLabel below for the real, EVM-details-dependent label.
}

// What MetaMask/an EVM wallet links to ("view on explorer") — same pattern
// as the backend's EVM_TX_HASH_PATTERN in routes/transactions.ts.
const EVM_TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

// A MsgEthereumTx is a thin wrapper — what it actually did only becomes
// knowable once the EVM execution details load (contract call vs. a plain
// native-STEEM transfer vs. deploying a new contract), unlike every other
// message type here where the typeUrl alone says what happened.
const getEvmTxKindLabel = (details: EvmTransactionDetails): string => {
  if (details.method) return details.method
  if (!details.to) return 'Contract Creation'
  if (details.toIsContract) return 'Contract Call'
  return 'STEEM Transfer'
}

const TOKEN_TRANSFER_TYPE_LABELS: Record<string, string> = {
  token_minting: 'Mint',
  token_transfer: 'Transfer',
}

// Event types with nothing worth showing: `tx`/`message` are pure
// bookkeeping (signature/sequence noise, or the same action/sender already
// shown in the Messages section above), and `coin_spent`/`coin_received`
// duplicate `transfer`/`coinbase` — the Cosmos SDK bank module emits all
// three for the same movement, but `transfer` alone already has sender,
// recipient, and amount, so keeping all three just triples the noise for no
// extra information.
const HIDDEN_EVENT_TYPES = new Set([
  'tx',
  'message',
  'coin_spent',
  'coin_received',
])

// These two event types describe a single fund movement and get a dedicated
// "from → to" line instead of a generic attribute dump.
const FUND_MOVEMENT_EVENT_TYPES = new Set(['transfer', 'coinbase'])

// Attribute keys that repeat on nearly every event but never mean anything
// to a reader (internal bookkeeping) — dropped from the compact summary line.
// txHash is the ethereum_tx event's own copy of the outer Cosmos tx hash
// (same value, just lowercased) — already shown at the top of this page, so
// repeating it here is pure noise, not new information.
const NOISY_ATTRIBUTE_KEYS = new Set(['msg_index', 'txHash'])

// Friendly names for the module accounts this chain's bridge actually moves
// funds through — `tx.moduleAccounts` resolves any bech32 address to its raw
// module name (e.g. "steemblackhole"); this is just presentation polish on
// top of that, for the ones a bridge deposit/withdrawal touches.
const MODULE_ACCOUNT_LABELS: Record<string, string> = {
  steemblackhole: 'Bridge Mint/Burn',
  bridge_reward: 'Bridge Reward Pool',
  fee_collector: 'Fee Collector',
  steembridge: 'Bridge Escrow',
}

const humanizeModuleName = (name: string) =>
  name
    .replace(/_/g, ' ')
    // Most event attribute keys are snake_case, but the ethereum_tx event's
    // are camelCase (ethereumTxHash, txGasUsed, ...) — without this, those
    // rendered as one squished word ("EthereumTxHash") instead of readable
    // separate words.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())

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

// Reused both inline (a MsgEthereumTx found within an indexed SVM tx) and
// standalone (an EVM-format hash with no SVM-side wrapper indexed at all —
// see the txLookupFailed fallback below) so the two cases render identically.
const EvmExecutionPanel: React.FC<{
  details: EvmTransactionDetails | undefined
  isLoading: boolean
}> = ({ details, isLoading }) => {
  const { colors } = useTheme()

  if (!isLoading && !details) return null

  return (
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

      {!details ? (
        <div
          className="px-5 py-[18px] text-[13px]"
          style={{ color: colors.text.secondary }}
        >
          Loading EVM execution details...
        </div>
      ) : (
        <div className="flex flex-col gap-[16px] px-5 py-[18px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <span
              className="reference-pill"
              style={getMessageTypePillStyle(getEvmTxKindLabel(details), colors)}
            >
              {getEvmTxKindLabel(details)}
            </span>
            <span
              className="reference-pill"
              style={getResultPillStyle(details.status === 'ok', colors)}
            >
              {details.status === 'ok' ? 'Success' : 'Failed'}
            </span>
          </div>

          {details.to && (
            <div className="flex flex-col gap-1">
              <span
                className="text-[11.5px]"
                style={{ color: colors.text.tertiary }}
              >
                {details.toIsContract ? 'Interacted With (Contract)' : 'To'}
              </span>
              <span
                className="break-all font-mono text-[12.5px]"
                style={{ color: colors.text.primary }}
              >
                {details.to}
              </span>
            </div>
          )}

          {details.value !== '0' && details.to && (
            <div className="flex flex-col gap-2">
              <span
                className="text-[11.5px]"
                style={{ color: colors.text.tertiary }}
              >
                Value Transferred
              </span>
              <div
                className="flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2"
                style={{ borderColor: colors.border.primary }}
              >
                <span
                  className="font-mono text-[12px]"
                  style={{ color: colors.text.secondary }}
                  title={details.from}
                >
                  {trimHash(details.from, 10)}
                </span>
                <FiArrowRight
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: colors.text.tertiary }}
                />
                <span
                  className="font-mono text-[12px]"
                  style={{ color: colors.text.secondary }}
                  title={details.to}
                >
                  {trimHash(details.to, 10)}
                </span>
                <span
                  className="ml-auto font-mono text-[12.5px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {formatTokenAmount(details.value, '18', 'STEEM')}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span
              className="text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              Fee
            </span>
            <span
              className="font-mono text-[12.5px]"
              style={{ color: colors.text.primary }}
            >
              {formatTokenAmount(details.fee, '18', 'STEEM')}
            </span>
          </div>

          {details.tokenTransfers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span
                className="text-[11.5px]"
                style={{ color: colors.text.tertiary }}
              >
                Tokens Transferred ({details.tokenTransfers.length})
              </span>
              <div className="flex flex-col gap-2">
                {details.tokenTransfers.map((transfer, index) => (
                  <div
                    key={`${transfer.tokenAddress}-${index}`}
                    className="flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2"
                    style={{ borderColor: colors.border.primary }}
                  >
                    <span
                      className="reference-pill"
                      style={getMessageTypePillStyle(transfer.type, colors)}
                    >
                      {TOKEN_TRANSFER_TYPE_LABELS[transfer.type] || 'Transfer'}
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

          {details.explorerUrl && (
            <a
              href={details.explorerUrl}
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
  )
}

const TransactionDetail: React.FC = () => {
  const { hash } = useParams<{ hash: string }>()
  const { colors } = useTheme()
  const isEvmHashParam = Boolean(hash && EVM_TX_HASH_PATTERN.test(hash))

  const {
    data: tx,
    isLoading,
    isError: txLookupFailed,
  } = useQuery({
    queryKey: ['transaction', hash],
    queryFn: () =>
      apiClient.get<TransactionDetailResponse>(`/transactions/${hash}`),
    enabled: Boolean(hash),
    retry: false,
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

  // Fallback for an EVM-format hash (what MetaMask links to) with no SVM-side
  // wrapper tx indexed for it yet — the chain's own EVM JSON-RPC still knows
  // about it independently of our indexer, so show that rather than a bare
  // "not found." Only fires once the primary lookup has definitively failed.
  const {
    data: evmOnlyDetails,
    isLoading: isEvmOnlyLoading,
    isError: evmOnlyFailed,
  } = useQuery({
    queryKey: ['evm-transaction-standalone', hash],
    queryFn: () => apiClient.get<EvmTransactionDetails>(`/evm/tx/${hash}`),
    enabled: isEvmHashParam && txLookupFailed,
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
    const type =
      rawType === 'EthereumTx'
        ? evmDetails
          ? getEvmTxKindLabel(evmDetails)
          : 'EVM Transaction'
        : TYPE_LABELS[rawType] || rawType

    // The outer Cosmos tx's `fee` is always empty for a MsgEthereumTx on this
    // chain (the EVM ante handler deducts gas cost directly rather than
    // through the standard Cosmos fee field) — fall back to the EVM
    // execution details' computed fee (gasUsed * effectiveGasPrice) once
    // that's loaded, rather than showing a blank "—" for every EVM tx.
    const fee =
      tx.fee.length > 0
        ? formatFee(tx.fee)
        : evmDetails
          ? formatTokenAmount(evmDetails.fee, '18', 'STEEM')
          : formatFee(tx.fee)

    return {
      fee,
      gasUsed: formatGas(tx.gasUsed),
      gasWanted: formatGas(tx.gasWanted),
      memo: tx.memo || '—',
      status: tx.success ? 'Success' : 'Failed',
      type,
    }
  }, [tx, evmDetails])

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

  const visibleEvents = useMemo(
    () => tx?.events.filter((event) => !HIDDEN_EVENT_TYPES.has(event.type)) ?? [],
    [tx]
  )

  const renderEventAttributeValue = (value: string) => {
    const moduleName = tx?.moduleAccounts[value]
    if (moduleName) {
      return (
        <span title={value}>
          {MODULE_ACCOUNT_LABELS[moduleName] ?? humanizeModuleName(moduleName)}{' '}
          <span style={{ color: colors.text.tertiary }}>({moduleName})</span>
        </span>
      )
    }

    if (value.includes('valoper')) {
      return (
        <Link to={`/validators/${value}`} style={{ color: colors.primary }}>
          {value}
        </Link>
      )
    }

    if (isBech32Address(value)) {
      return (
        <Link to={`/accounts/${value}`} style={{ color: colors.primary }}>
          {value}
        </Link>
      )
    }

    const coin = parseCoinString(value)
    if (coin) {
      return (
        <span className="font-mono">
          {formatCoinAmount(coin.amount, coin.denom)}
        </span>
      )
    }

    return <span>{value}</span>
  }

  // One line per event instead of a full attribute table — a fund-movement
  // event (transfer/coinbase) reads as "from → to  amount", everything else
  // as a short "Label  key: value  key: value" line. Cuts a ~20-row wall of
  // near-duplicate coin_spent/coin_received/transfer rows down to the handful
  // of lines that actually say something.
  const renderEventRow = (event: (typeof visibleEvents)[number]) => {
    const attrs = Object.fromEntries(
      event.attributes.map((a) => [a.key, a.value])
    )

    if (FUND_MOVEMENT_EVENT_TYPES.has(event.type)) {
      const from = attrs.sender ?? attrs.minter
      const to = attrs.recipient
      return (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {from && renderEventAttributeValue(from)}
          <FiArrowRight
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: colors.text.tertiary }}
          />
          {to ? (
            renderEventAttributeValue(to)
          ) : (
            <span style={{ color: colors.text.tertiary }}>
              {event.type === 'coinbase' ? '(minted)' : '—'}
            </span>
          )}
          {attrs.amount && (
            <span
              className="ml-auto font-mono font-semibold"
              style={{ color: colors.text.primary }}
            >
              {renderEventAttributeValue(attrs.amount)}
            </span>
          )}
        </div>
      )
    }

    const parts = event.attributes.filter(
      (a) => !NOISY_ATTRIBUTE_KEYS.has(a.key)
    )
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        <span
          className="reference-pill shrink-0"
          style={getMessageTypePillStyle(event.type, colors)}
        >
          {humanizeModuleName(event.type)}
        </span>
        {parts.map((attribute, index) => (
          <span key={`${attribute.key}-${index}`}>
            <span style={{ color: colors.text.tertiary }}>
              {humanizeModuleName(attribute.key)}:
            </span>{' '}
            <span style={{ color: colors.text.primary }} title={attribute.value}>
              {attribute.key === 'exchange_rate'
                ? `${attribute.value.split(',').length} pairs`
                : event.type === 'ethereum_tx' && attribute.key === 'amount'
                  ? // Bare wei, unlike a bank-module event's amount+denom
                    // string (parseCoinString has nothing to split here) —
                    // this is always native asteem on this chain's EVM side.
                    formatCoinAmount(attribute.value, 'asteem')
                  : renderEventAttributeValue(attribute.value)}
            </span>
          </span>
        ))}
      </div>
    )
  }

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  if (isLoading || (isEvmHashParam && txLookupFailed && isEvmOnlyLoading)) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>
          Loading transaction data...
        </p>
      </div>
    )
  }

  // No SVM-side tx indexed for this hash (e.g. what MetaMask links to) —
  // still show what the chain's own EVM JSON-RPC knows about it, rather than
  // just "not found", since that data doesn't depend on our indexer at all.
  if (evmOnlyDetails) {
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
          <div className="mb-[10px] flex flex-wrap items-center gap-[13px]">
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
                EVM Transaction
              </span>
              <div>
                <span
                  className="reference-pill"
                  style={getMessageTypePillStyle(
                    getEvmTxKindLabel(evmOnlyDetails),
                    colors
                  )}
                >
                  {getEvmTxKindLabel(evmOnlyDetails)}
                </span>
              </div>
            </div>

            <div className="flex-1" />

            <span
              className="reference-pill"
              style={getResultPillStyle(
                evmOnlyDetails.status === 'ok',
                colors
              )}
            >
              {evmOnlyDetails.status === 'ok' ? 'Success' : 'Failed'}
            </span>
          </div>

          <span
            className="break-all font-mono text-[12.5px]"
            style={{ color: colors.text.secondary }}
          >
            {hash}
          </span>

          <p
            className="mt-3 text-[12.5px]"
            style={{ color: colors.text.tertiary }}
          >
            No SVM-side transaction is indexed for this hash yet — this is
            what the chain's own EVM JSON-RPC reports independently.
          </p>
        </div>

        <EvmExecutionPanel details={evmOnlyDetails} isLoading={false} />
      </div>
    )
  }

  if (!tx || !txMeta) {
    return (
      <div className="flex min-h-[380px] items-center justify-center">
        <p style={{ color: colors.text.secondary }}>
          {isEvmHashParam && evmOnlyFailed
            ? "Transaction not found — no SVM-side wrapper is indexed for this hash, and the chain's EVM JSON-RPC doesn't know it either."
            : 'Transaction not found'}
        </p>
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
        <EvmExecutionPanel details={evmDetails} isLoading={isEvmLoading} />
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

                {message.fields.map((field, fieldIndex) =>
                  field.key === 'exchangeRates' && Array.isArray(field.value) ? (
                    <div
                      key={`${field.key}-${fieldIndex}`}
                      className="flex flex-col gap-2 border-t py-[9px]"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <span
                        className="text-[12.5px]"
                        style={{ color: colors.text.secondary }}
                      >
                        Exchange Rates
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(field.value as ExchangeRateVoteEntry[]).map(
                          (entry) => (
                            <span
                              key={entry.pair}
                              className="reference-pill font-mono"
                              style={{
                                backgroundColor: colors.backgroundSecondary,
                                color: colors.text.primary,
                              }}
                            >
                              {entry.pair.replace(/_/g, ' ')}: {entry.rate}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
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
                        ) : field.key === 'registrationId' ? (
                          <Link
                            to={`/svmns/registrations/${field.value}`}
                            style={{ color: colors.primary }}
                          >
                            {stringifyField(field.value)}
                          </Link>
                        ) : (
                          stringifyField(field.value)
                        )}
                      </div>
                    </div>
                  )
                )}
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

      {visibleEvents.length > 0 && (
        <div className="reference-table-shell rounded-[14px]">
          <div
            className="border-b px-5 py-[15px] text-[14px] font-semibold"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          >
            Fund Flow & Events ({visibleEvents.length})
          </div>

          <div
            className="flex flex-col divide-y px-5"
            style={{ borderColor: colors.border.primary }}
          >
            {visibleEvents.map((event, eventIndex) => (
              <div key={`${event.type}-${eventIndex}`} className="py-[9px]">
                {renderEventRow(event)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionDetail
