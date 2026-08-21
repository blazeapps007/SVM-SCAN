import type { FastifyInstance, FastifyReply } from 'fastify'
import type { ExchangeRate } from '@dexplorer/shared'
import { env } from '../config/env'
import { fetchExchangeRates } from '../chain/oracleLcd'
import { TtlCache } from '../utils/ttlCache'

// No indexer/Mongo collection backs this — exchange rates are current chain
// state, not history to index, so this proxies the LCD live, same pattern as
// GET /api/accounts/:address and the name-service routes. Cached briefly
// since rates only change once per oracle vote period (~10 min by default).
const cache = new TtlCache<ExchangeRate[]>(30_000)

function requireLcdUrl(reply: FastifyReply): string | null {
  if (!env.STEEMBRIDGE_LCD_URL) {
    reply.status(503).send({ error: 'Oracle data unavailable' })
    return null
  }
  return env.STEEMBRIDGE_LCD_URL
}

export function registerOracleRoutes(app: FastifyInstance): void {
  app.get('/oracle/exchange-rates', async (_request, reply) => {
    const lcdUrl = requireLcdUrl(reply)
    if (!lcdUrl) return

    const cached = cache.get('exchange-rates')
    if (cached) {
      return cached
    }

    const raw = await fetchExchangeRates(lcdUrl)
    const data: ExchangeRate[] = raw.map((rate) => ({
      pair: rate.pair,
      rate: rate.rate,
      updateEpoch: rate.update_epoch,
      updateTime: rate.update_time,
    }))

    cache.set('exchange-rates', data)
    return data
  })
}
