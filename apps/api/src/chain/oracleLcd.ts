// Minimal LCD/REST client for the chain's custom oracledata module
// (steemvm.oracle.data.v1) — commit-reveal price-feed voting for the
// STEEM/SBD/USD pairs the steembridge module needs. Same base LCD URL and
// fetch + withTimeout pattern as steembridgeLcd.ts; kept in its own file
// since it's a distinct module with its own REST path prefix. Response
// shapes below were verified live against a real node.

import { withTimeout } from './withTimeout'

export interface RawOracleParams {
  vote_period: string
  vote_threshold: string
  reward_band: string
  miss_band: string
  whitelist: string[]
}

export interface RawExchangeRate {
  pair: string
  rate: string
  update_epoch: string
  update_time: string
}

async function lcdGet<T>(url: string, label: string): Promise<T> {
  const response = await withTimeout(fetch(url), `oracledata:${label}`)
  if (!response.ok) {
    throw new Error(`oracledata LCD ${label} failed: HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

// GET /steemvm/oracle/data/v1/params — vote period, vote threshold,
// reward/miss bands, whitelisted pairs.
export async function fetchOracleParams(
  lcdUrl: string
): Promise<RawOracleParams> {
  const url = `${lcdUrl}/steemvm/oracle/data/v1/params`
  const json = await lcdGet<{ params: RawOracleParams }>(url, 'params')
  return json.params
}

// GET /steemvm/oracle/data/v1/exchange_rates — every whitelisted pair's
// finalized power-weighted-median rate, refreshed once per vote period.
export async function fetchExchangeRates(
  lcdUrl: string
): Promise<RawExchangeRate[]> {
  const url = `${lcdUrl}/steemvm/oracle/data/v1/exchange_rates`
  const json = await lcdGet<{ exchange_rates: RawExchangeRate[] }>(
    url,
    'exchange_rates'
  )
  return json.exchange_rates
}
