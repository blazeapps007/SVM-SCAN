// Minimal LCD/REST client for the chain's custom steembridge module (Steem/
// SBD deposit oracle attestations). No proto or ABCI query path exists for
// this module, so it's queried over the chain's LCD REST API (port 1317)
// instead — modeled on evmRpc.ts's fetch + withTimeout pattern. Response
// shapes below were verified live against a real node, not assumed from
// spec (see the Bridge Deposits plan for the raw examples).

import { withTimeout } from './withTimeout'

export interface RawValidatorConfirmation {
  validator_address: string
  timestamp: string
}

export interface RawSteemBridgeDeposit {
  id: string
  txid: string
  op_index: number
  steem_block: string
  steem_timestamp: string
  steem_sender: string
  gateway_account: string
  amount_millisteem: string
  memo: string
  derived_destination: string
  destination_type: string
  status: string
  minted: boolean
  minted_at: string
  mint_tx_hash: string
  created_at: string
  validator_confirmations: RawValidatorConfirmation[]
}

export interface RawSteemBridgeWithdrawal {
  id: string
  sender: string
  destination_steem_account: string
  amount_asteem: string
  amount_millisteem: string
  memo: string
  burn_tx_hash: string
  status: string
  created_at: string
}

export interface RawBridgeStatistics {
  total_minted_asteem: string
  total_burned_asteem: string
  net_outstanding: string
}

interface RawPagination {
  next_key: string | null
  total: string
}

interface DepositPage {
  items: RawSteemBridgeDeposit[]
  nextKey: string | null
}

interface WithdrawalPage {
  items: RawSteemBridgeWithdrawal[]
  nextKey: string | null
}

async function lcdGet<T>(url: string, label: string): Promise<T> {
  const response = await withTimeout(fetch(url), `steembridge:${label}`)
  if (!response.ok) {
    throw new Error(`steembridge LCD ${label} failed: HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function buildPaginationQuery(opts: {
  limit: number
  reverse?: boolean
  key?: string
}): string {
  const params = new URLSearchParams()
  params.set('pagination.limit', String(opts.limit))
  if (opts.reverse) params.set('pagination.reverse', 'true')
  if (opts.key) params.set('pagination.key', opts.key)
  return params.toString()
}

// GET /steemvm/steembridge/v1/deposit — the unfiltered full list (every
// deposit regardless of status). Response key is singular ("deposit") even
// though it's an array — verified live, not a typo.
export async function fetchDeposits(
  lcdUrl: string,
  opts: { limit: number; reverse?: boolean; key?: string }
): Promise<DepositPage> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/deposit?${buildPaginationQuery(opts)}`
  const json = await lcdGet<{
    deposit: RawSteemBridgeDeposit[]
    pagination: RawPagination
  }>(url, 'deposit')
  return { items: json.deposit, nextKey: json.pagination.next_key || null }
}

// GET /steemvm/steembridge/v1/pending_deposits — only deposits still
// awaiting confirmations. Response key is plural ("deposits") — different
// from the /deposit endpoint above, verified live.
export async function fetchPendingDeposits(
  lcdUrl: string,
  opts: { limit: number; key?: string }
): Promise<DepositPage> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/pending_deposits?${buildPaginationQuery(opts)}`
  const json = await lcdGet<{
    deposits: RawSteemBridgeDeposit[]
    pagination: RawPagination
  }>(url, 'pending_deposits')
  return { items: json.deposits, nextKey: json.pagination.next_key || null }
}

// GET /steemvm/steembridge/v1/withdrawal — the unfiltered full list. Same
// singular-key-for-a-list-endpoint quirk as /deposit, verified live.
export async function fetchWithdrawals(
  lcdUrl: string,
  opts: { limit: number; reverse?: boolean; key?: string }
): Promise<WithdrawalPage> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/withdrawal?${buildPaginationQuery(opts)}`
  const json = await lcdGet<{
    withdrawal: RawSteemBridgeWithdrawal[]
    pagination: RawPagination
  }>(url, 'withdrawal')
  return { items: json.withdrawal, nextKey: json.pagination.next_key || null }
}

// GET /steemvm/steembridge/v1/requested_withdrawals — only withdrawals still
// awaiting payout (currently the only status that exists). Plural key.
export async function fetchRequestedWithdrawals(
  lcdUrl: string,
  opts: { limit: number; key?: string }
): Promise<WithdrawalPage> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/requested_withdrawals?${buildPaginationQuery(opts)}`
  const json = await lcdGet<{
    withdrawals: RawSteemBridgeWithdrawal[]
    pagination: RawPagination
  }>(url, 'requested_withdrawals')
  return { items: json.withdrawals, nextKey: json.pagination.next_key || null }
}

// GET /steemvm/steembridge/v1/bridge_statistics — chain-wide totals, no
// pagination, single object.
export async function fetchBridgeStatistics(
  lcdUrl: string
): Promise<RawBridgeStatistics> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/bridge_statistics`
  return lcdGet<RawBridgeStatistics>(url, 'bridge_statistics')
}
