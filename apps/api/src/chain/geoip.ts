import { isIP } from 'node:net'
import { withTimeout } from './withTimeout'
import { TtlCache } from '../utils/ttlCache'

export interface Country {
  code: string
  name: string
}

// country.is is free, keyless and open source; answers are ISO 3166-1
// alpha-2 codes, named locally via ICU so no country data is bundled.
const GEOIP_URL = 'https://api.country.is'
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

// A node's IP rarely moves country — re-query once a day, not every refresh.
// Keyed by IP, held in memory only: IPs are never persisted or returned.
const countryCache = new TtlCache<Country | null>(24 * 60 * 60_000, 200)

const PRIVATE_IPV4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/

const isPublicIp = (ip: string): boolean => {
  const version = isIP(ip)
  if (version === 4) return !PRIVATE_IPV4.test(ip)
  if (version === 6) return !/^(::1$|fc|fd|fe80:)/i.test(ip)
  return false
}

export async function lookupCountry(ip: string): Promise<Country | null> {
  if (!isPublicIp(ip)) return null

  const cached = countryCache.get(ip)
  if (cached !== undefined) return cached

  try {
    const response = await withTimeout(
      fetch(`${GEOIP_URL}/${encodeURIComponent(ip)}`),
      'geoip lookup'
    )
    if (!response.ok) return null
    const { country } = (await response.json()) as { country?: string }
    if (!country || !/^[A-Z]{2}$/.test(country)) return null

    const result = { code: country, name: regionNames.of(country) ?? country }
    countryCache.set(ip, result)
    return result
  } catch {
    // Not cached, so a transient outage is retried on the next refresh.
    return null
  }
}
