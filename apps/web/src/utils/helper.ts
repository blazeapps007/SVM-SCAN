import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import duration from 'dayjs/plugin/duration'
import { toHex } from '@cosmjs/encoding'
import { bech32 } from 'bech32'

// Plain fetch() has no default timeout — a hung external API (e.g. Keybase,
// called directly from a couple of components, not through apiClient.ts)
// would otherwise leave that fetch pending forever.
export async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export const timeFromNow = (date: string): string => {
  dayjs.extend(relativeTime)
  const now = dayjs()
  const then = dayjs(date)
  const diffInSeconds = now.diff(then, 'second')

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  }

  const diffInMinutes = now.diff(then, 'minute')
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = now.diff(then, 'hour')
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = now.diff(then, 'day')
  if (diffInDays < 30) {
    return `${diffInDays}d ago`
  }

  return dayjs(date).fromNow()
}

export function trimHash(txHash: Uint8Array): string
export function trimHash(txHash: string, length?: number): string
export function trimHash(txHash: Uint8Array | string, length?: number): string {
  let hash: string

  if (txHash instanceof Uint8Array) {
    hash = toHex(txHash).toUpperCase()
    const first = hash.slice(0, 5)
    const last = hash.slice(hash.length - 5, hash.length)
    return first + '...' + last
  } else {
    hash = txHash.toUpperCase()
    const trimLength = length || 8
    if (hash.length <= trimLength * 2) {
      return hash
    }
    const first = hash.slice(0, trimLength)
    const last = hash.slice(hash.length - trimLength, hash.length)
    return first + '...' + last
  }
}

export const displayDate = (date: string): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

export const displayDurationSeconds = (seconds: number | undefined): string => {
  if (!seconds) {
    return ``
  }
  dayjs.extend(duration)
  dayjs.extend(relativeTime)
  return dayjs.duration({ seconds: seconds }).humanize()
}

export const isBech32Address = (address: string): boolean => {
  try {
    const decoded = bech32.decode(address)
    if (decoded.prefix.includes('valoper')) {
      return false
    }

    if (decoded.words.length < 1) {
      return false
    }

    const encoded = bech32.encode(decoded.prefix, decoded.words)
    return encoded === address
  } catch {
    return false
  }
}

export const convertRateToPercent = (rate: string | undefined): string => {
  if (!rate) {
    return ``
  }
  const commission = (Number(rate) / 10 ** 16).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${commission}%`
}

export const getActionFromAttributes = (
  attributes: { key: string; value: string; index?: boolean }[]
) => {
  const action = attributes.find((a) => {
    if (a.key == 'action') {
      return a.value
    }
  })

  if (action) {
    return action.value
  }

  return ''
}

export const getModuleFromAttributes = (
  attributes: { key: string; value: string; index?: boolean }[]
) => {
  const module = attributes.find((a) => {
    if (a.key == 'module') {
      return a.value
    }
  })

  if (module) {
    return module.value
  }

  return ''
}

export const getTypeMsg = (typeUrl: string): string => {
  const arr = typeUrl.split('.')
  if (arr.length) {
    return arr[arr.length - 1].replace('Msg', '')
  }
  return ''
}

export function isValidJSON(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

// Some chains (e.g. Steem-derived ones) pack semicolon-separated key=value
// pairs into a validator's free-text `details` field (owner/active/posting
// keys). Split those onto their own lines when the pattern is detected;
// returns null when `details` is just a normal free-text description, so
// callers can fall back to rendering it as plain text.
export const parseDetailsLines = (
  details: string
): { key: string; value: string }[] | null => {
  if (!details.includes('=') || !details.includes(';')) return null

  const parts = details
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)

  const pairs = parts.map((part) => {
    const eqIndex = part.indexOf('=')
    if (eqIndex === -1) return null
    return {
      key: part.slice(0, eqIndex).trim(),
      value: part.slice(eqIndex + 1).trim(),
    }
  })

  if (pairs.length === 0 || pairs.some((pair) => pair === null || !pair.key)) {
    return null
  }
  return pairs as { key: string; value: string }[]
}

// Converts a raw base-unit amount by an arbitrary decimal count using
// BigInt math — amounts routinely exceed Number's safe integer range, so no
// float division here. Returns just the number (no symbol); trailing zeros
// in the fractional part are trimmed.
export const convertRawAmount = (rawAmount: string, decimals: number): string => {
  try {
    const value = BigInt(rawAmount)
    const divisor = 10n ** BigInt(decimals)
    const whole = value / divisor
    const fraction = value % divisor
    if (decimals === 0 || fraction === 0n) {
      return whole.toString()
    }
    const fractionStr = fraction
      .toString()
      .padStart(decimals, '0')
      .replace(/0+$/, '')
    return fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString()
  } catch {
    return rawAmount
  }
}

// Same conversion, with a "<amount> <SYMBOL>" string ready to display (used
// for EVM token transfers, where decimals arrive as a string from the
// chain).
export const formatTokenAmount = (
  rawAmount: string | null,
  decimals: string | null,
  symbol: string | null
): string => {
  const suffix = symbol ? ` ${symbol}` : ''
  if (!rawAmount) return `—${suffix}`

  const decimalsNum = decimals ? parseInt(decimals, 10) : 0
  return `${convertRawAmount(rawAmount, decimalsNum)}${suffix}`
}

// The steembridge module supports more than one bridged asset (currently
// STEEM and SBD, both minted 1:1 at 18 decimals — just under a different
// denom prefix, asteem vs asbd) — this strips the "BRIDGE_ASSET_" prefix off
// a deposit/withdrawal's `asset` field to get the display symbol, e.g.
// "BRIDGE_ASSET_SBD" -> "SBD".
export const bridgeAssetSymbol = (asset: string): string =>
  asset.replace('BRIDGE_ASSET_', '')

// Splits a Cosmos SDK bank-module event attribute value like
// "998000000000000000asteem" into its numeric amount and trailing denom —
// `coin_spent`/`coin_received`/`transfer`/`coinbase` events concatenate the
// two into one string, unlike a Coin object elsewhere which already has
// separate fields.
export function parseCoinString(
  value: string
): { amount: string; denom: string } | null {
  const match = value.match(/^(\d+)([a-zA-Z][a-zA-Z0-9/-]*)$/)
  if (!match) return null
  return { amount: match[1], denom: match[2] }
}

// Helper function to safely serialize objects with BigInt values
export const safeStringify = (obj: unknown, space?: number): string => {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    },
    space
  )
}
