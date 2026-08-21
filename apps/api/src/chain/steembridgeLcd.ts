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
  asset: string
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
  asset: string
  fee_millisteem: string
  // Empty until status flips to PROCESSED.
  steem_payout_txid: string
  payout_op_index: number
  // "0" until status flips to PROCESSED.
  processed_at: string
  // "0" unless this withdrawal auto-refunded on-chain after
  // withdrawal_timeout_blocks without ever being attested.
  refunded_at: string
  validator_confirmations: RawValidatorConfirmation[]
}

export interface RawBridgeParams {
  bridge_enabled: boolean
  bridge_out_enabled: boolean
  gateway_account: string
  bridge_confirmation_threshold: string
  minimum_bridge_amount: string
  maximum_bridge_amount: string
  deposit_timeout_blocks: string
  name_service_enabled: boolean
  name_registration_min_millisteem: string
  name_pending_timeout_blocks: string
  relayer_start_block: string
  bridge_fee_bps: number
  withdrawal_timeout_blocks: string
}

export interface RawNameRecord {
  steem_account: string
  address: string
  registration_id: string
  linked_at: string
}

export interface RawNameRegistration {
  id: string
  txid: string
  op_index: number
  steem_block: string
  steem_timestamp: string
  steem_account: string
  gateway_account: string
  amount_millisteem: string
  memo: string
  derived_destination: string
  destination_type: string
  status: string
  created_at: string
  awaiting_since: string
  confirmed_at: string
  confirm_tx_hash: string
  validator_confirmations: RawValidatorConfirmation[]
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

interface NameRegistrationPage {
  items: RawNameRegistration[]
  nextKey: string | null
}

async function lcdGet<T>(url: string, label: string): Promise<T> {
  const response = await withTimeout(fetch(url), `steembridge:${label}`)
  if (!response.ok) {
    throw new Error(`steembridge LCD ${label} failed: HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

// This LCD returns a missing record as HTTP 500 with a Cosmos SDK
// "key not found" error body (not a 404), and an invalid address as HTTP 400
// "invalid address" — both verified live. Both mean "no result" for a search,
// not a real server error, so this returns null instead of throwing for
// either shape.
async function lcdGetOrNull<T>(url: string, label: string): Promise<T | null> {
  const response = await withTimeout(fetch(url), `steembridge:${label}`)
  if (response.ok) {
    return (await response.json()) as T
  }
  if (response.status === 500 || response.status === 400) {
    const body = (await response.json().catch(() => null)) as {
      message?: string
    } | null
    if (
      body?.message?.includes('key not found') ||
      body?.message?.includes('invalid address')
    ) {
      return null
    }
  }
  throw new Error(`steembridge LCD ${label} failed: HTTP ${response.status}`)
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

// GET /steemvm/steembridge/v1/params — module config: bridge enable flags,
// confirmation threshold, min/max bridge amount, fee bps, timeouts. Verified
// live. `gateway_account` here is display-only — the real gateway account is
// a hardcoded chain constant ("svm.bank"), not something governance changes
// by editing this field.
export async function fetchBridgeParams(lcdUrl: string): Promise<RawBridgeParams> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/params`
  const json = await lcdGet<{ params: RawBridgeParams }>(url, 'params')
  return json.params
}

// GET /steemvm/steembridge/v1/name/{steem_account} — the current active
// link for a Steem username, if any.
export async function resolveName(
  lcdUrl: string,
  steemAccount: string
): Promise<RawNameRecord | null> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/name/${encodeURIComponent(steemAccount)}`
  const json = await lcdGetOrNull<{ name: RawNameRecord }>(url, 'name')
  return json?.name ?? null
}

// GET /steemvm/steembridge/v1/names_by_address/{address} — reverse lookup:
// every active name an address owns.
export async function fetchNamesByAddress(
  lcdUrl: string,
  address: string
): Promise<RawNameRecord[]> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/names_by_address/${encodeURIComponent(address)}`
  const json = await lcdGetOrNull<{ names: RawNameRecord[] }>(
    url,
    'names_by_address'
  )
  return json?.names ?? []
}

// GET /steemvm/steembridge/v1/name_registrations_by_account/{steem_account}
// — full registration history (pending/awaiting/active/superseded/expired)
// for a Steem username. This is the only way to enumerate a name's history,
// since there's no generic "list all registrations" query.
export async function fetchNameRegistrationsByAccount(
  lcdUrl: string,
  steemAccount: string
): Promise<RawNameRegistration[]> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/name_registrations_by_account/${encodeURIComponent(steemAccount)}`
  const json = await lcdGetOrNull<{ registrations: RawNameRegistration[] }>(
    url,
    'name_registrations_by_account'
  )
  return json?.registrations ?? []
}

// GET /steemvm/steembridge/v1/name_registration/{id} — one registration by
// its internal id.
export async function fetchNameRegistration(
  lcdUrl: string,
  id: string
): Promise<RawNameRegistration | null> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/name_registration/${encodeURIComponent(id)}`
  const json = await lcdGetOrNull<{ registration: RawNameRegistration }>(
    url,
    'name_registration'
  )
  return json?.registration ?? null
}

// GET /steemvm/steembridge/v1/pending_name_registrations — registrations
// still accumulating validator attestations.
export async function fetchPendingNameRegistrations(
  lcdUrl: string,
  opts: { limit: number; key?: string }
): Promise<NameRegistrationPage> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/pending_name_registrations?${buildPaginationQuery(opts)}`
  const json = await lcdGet<{
    registrations: RawNameRegistration[]
    pagination: RawPagination
  }>(url, 'pending_name_registrations')
  return { items: json.registrations, nextKey: json.pagination.next_key || null }
}

// GET /steemvm/steembridge/v1/awaiting_name_registrations — registrations
// that hit the confirmation threshold and now await the destination
// address's confirm-name tx.
export async function fetchAwaitingNameRegistrations(
  lcdUrl: string,
  opts: { limit: number; key?: string }
): Promise<NameRegistrationPage> {
  const url = `${lcdUrl}/steemvm/steembridge/v1/awaiting_name_registrations?${buildPaginationQuery(opts)}`
  const json = await lcdGet<{
    registrations: RawNameRegistration[]
    pagination: RawPagination
  }>(url, 'awaiting_name_registrations')
  return { items: json.registrations, nextKey: json.pagination.next_key || null }
}
