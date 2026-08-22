/**
 * Utility functions for Cosmos ecosystem denomination conversion
 */

/**
 * Convert amount from micro units (divide by 10^6)
 * @param amount - The amount string to convert
 * @returns Converted amount with 6 decimal places
 */
export const convertFromMicroUnits = (amount: string): string => {
  const num = parseFloat(amount)
  return (num / 1e6).toFixed(6)
}

/**
 * Convert amount from atto units (divide by 10^18)
 * @param amount - The amount string to convert
 * @returns Converted amount with 18 decimal places
 */
export const convertFromAttoUnits = (amount: string): string => {
  const num = parseFloat(amount)
  return (num / 1e18).toFixed(18)
}

/**
 * Cosmos SDK's LegacyDec ("sdk.Dec") wire encoding is the internal
 * fixed-point big integer (logical value * 10^18) written out as a plain
 * ASCII digit string with no decimal point — this converts that into the
 * human-decimal string form (e.g. "0.334000000000000000") by inserting a
 * decimal point 18 places from the right. Needed for any Dec-typed field
 * decoded via cosmjs-types/ABCI (which leaves it in this raw wire form)
 * before it can be run through the usual atto/micro unit conversion below —
 * skipping this step for a Dec field that is *also* denominated in a
 * bond token (e.g. a validator's delegatorShares) silently leaves the
 * value scaled up by an extra 10^18.
 * @param raw - The raw digit-string LegacyDec value
 * @returns The human-decimal string form
 */
export const decodeLegacyDecString = (raw: string): string => {
  const negative = raw.startsWith('-')
  const digits = (negative ? raw.slice(1) : raw).padStart(19, '0')
  const whole = digits.slice(0, -18) || '0'
  const fraction = digits.slice(-18)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/**
 * Get base denomination by removing prefix
 * @param denom - The denomination string
 * @returns Base denomination without prefix
 */
export const getBaseDenom = (denom: string): string => {
  if (denom.startsWith('u')) {
    return denom.slice(1) // Remove 'u' prefix
  }
  if (denom.startsWith('a')) {
    return denom.slice(1) // Remove 'a' prefix
  }
  return denom
}

/**
 * Convert amount based on denomination prefix and return both converted amount and base denomination
 * @param amount - The amount string to convert
 * @param denom - The denomination string
 * @returns Object with converted amount and base denomination
 */
export const getConvertedAmount = (
  amount: string,
  denom: string
): { converted: string; base: string } => {
  if (denom.startsWith('u')) {
    return {
      converted: convertFromMicroUnits(amount),
      base: getBaseDenom(denom),
    }
  }
  if (denom.startsWith('a')) {
    return {
      converted: convertFromAttoUnits(amount),
      base: getBaseDenom(denom),
    }
  }
  return {
    converted: amount,
    base: denom,
  }
}

/**
 * Format amount with appropriate suffix (B, M, K) based on size
 * @param amount - The amount string to format
 * @returns Formatted amount string with suffix
 */
export const formatAmount = (amount: string) => {
  const num = parseFloat(amount)
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return parseFloat(amount).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })
}

const trimTrailingZeros = (value: string): string => {
  if (!value.includes('.')) return value
  return value.replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * Convert a raw on-chain amount (u-/a-prefixed base units, or already a
 * display denom) into a compact human-readable "<amount> <SYMBOL>" string,
 * e.g. ("1000000000000000", "asteem") -> "0.001 STEEM".
 * @param amount - The raw amount string
 * @param denom - The raw denomination string
 * @returns Formatted "<amount> <SYMBOL>" string, or "— <SYMBOL>" if amount is invalid
 */
export const formatCoinAmount = (amount: string, denom: string): string => {
  const { converted, base } = getConvertedAmount(amount, denom)
  const symbol = base.toUpperCase()
  const num = parseFloat(converted)

  if (!Number.isFinite(num)) return `— ${symbol}`

  const decimals = num !== 0 && num < 1 ? 6 : 2
  const display = trimTrailingZeros(num.toFixed(decimals)) || '0'
  return `${display} ${symbol}`
}

/**
 * Format IBC denomination by truncating with ellipsis
 * @param denom - The denomination string to format
 * @returns Formatted denomination string
 */
export const formatDenom = (denom: string) => {
  if (denom.startsWith('ibc/')) {
    return denom.slice(0, 12) + '...'
  }
  return denom
}

/**
 * Extract unique sender addresses from transaction events
 * @param events - Array of transaction events with type and attributes
 * @returns Array of unique sender addresses
 */
export const getSendersFromEvents = (
  events: { type: string; attributes: { key: string; value: string }[] }[]
): string[] => {
  if (!events || !Array.isArray(events)) {
    return []
  }

  const senders: string[] = []

  events.forEach((event) => {
    if (
      event?.type === 'message' &&
      event?.attributes &&
      Array.isArray(event.attributes)
    ) {
      event.attributes.forEach((attr: { key: string; value: string }) => {
        if (
          attr?.key === 'sender' &&
          attr?.value &&
          typeof attr.value === 'string'
        ) {
          senders.push(attr.value)
        }
      })
    }
  })

  // Return unique senders
  return [...new Set(senders)]
}
