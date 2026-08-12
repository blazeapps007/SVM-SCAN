import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Db } from 'mongodb'
import type { NameRecord, NameRegistration } from '@dexplorer/shared'
import type { AppContext } from '../server'
import { env } from '../config/env'
import {
  resolveName,
  fetchNamesByAddress,
  fetchNameRegistrationsByAccount,
  fetchNameRegistration,
  fetchPendingNameRegistrations,
  fetchAwaitingNameRegistrations,
  RawNameRecord,
  RawNameRegistration,
} from '../chain/steembridgeLcd'
import { resolveValidatorMonikers } from '../db/validatorLookup'

const CACHE_TTL_MS = 15_000
const cache = new Map<string, { fetchedAt: number; data: unknown }>()

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data as T
  }
  const data = await load()
  cache.set(key, { fetchedAt: Date.now(), data })
  return data
}

// No indexer/Mongo collection backs this module — the LCD query surface has
// no "list all registrations"/"list all names" query to walk (unlike
// deposits/withdrawals), so these routes proxy the LCD live, same pattern as
// GET /api/accounts/:address's TTL-cached proxy.
function requireLcdUrl(reply: FastifyReply): string | null {
  if (!env.STEEMBRIDGE_LCD_URL) {
    reply.status(503).send({ error: 'Name service unavailable' })
    return null
  }
  return env.STEEMBRIDGE_LCD_URL
}

// Same fix as bridgeDeposits.ts's toUtcIsoString — the Steem chain's
// steem_timestamp has no timezone designator even though it's UTC, which
// browsers parse as local time. The one exception is the literal "genesis"
// (a genesis-seeded registration has no real timestamp at all), left as-is.
function toUtcIsoString(raw: string): string {
  if (raw === 'genesis') return raw
  return /[Zz]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`
}

function toNameRecord(raw: RawNameRecord): NameRecord {
  return {
    steemAccount: raw.steem_account,
    address: raw.address,
    registrationId: raw.registration_id,
    linkedAt: raw.linked_at,
  }
}

function toNameRegistration(
  raw: RawNameRegistration,
  monikers: Map<string, string>
): NameRegistration {
  return {
    id: raw.id,
    txid: raw.txid,
    opIndex: raw.op_index,
    steemBlock: raw.steem_block,
    steemTimestamp: toUtcIsoString(raw.steem_timestamp),
    steemAccount: raw.steem_account,
    gatewayAccount: raw.gateway_account,
    amountMillisteem: raw.amount_millisteem,
    memo: raw.memo,
    derivedDestination: raw.derived_destination,
    destinationType: raw.destination_type as NameRegistration['destinationType'],
    status: raw.status,
    createdAtHeight: raw.created_at,
    awaitingSinceHeight: raw.awaiting_since,
    confirmedAtHeight: raw.confirmed_at,
    confirmTxHash: raw.confirm_tx_hash,
    validatorConfirmations: raw.validator_confirmations.map((c) => ({
      validatorAddress: c.validator_address,
      moniker: monikers.get(c.validator_address) ?? null,
      timestamp: c.timestamp,
    })),
  }
}

async function toNameRegistrations(
  db: Db,
  raws: RawNameRegistration[]
): Promise<NameRegistration[]> {
  const monikers = await resolveValidatorMonikers(
    db,
    raws.flatMap((r) => r.validator_confirmations.map((c) => c.validator_address))
  )
  return raws.map((raw) => toNameRegistration(raw, monikers))
}

export function registerNameServiceRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  app.get<{ Params: { steemAccount: string } }>(
    '/name-service/resolve/:steemAccount',
    async (request, reply) => {
      const lcdUrl = requireLcdUrl(reply)
      if (!lcdUrl) return

      const raw = await cached(`resolve:${request.params.steemAccount}`, () =>
        resolveName(lcdUrl, request.params.steemAccount)
      )
      if (!raw) {
        return reply.status(404).send({ error: 'Name not found' })
      }
      return toNameRecord(raw)
    }
  )

  app.get<{ Params: { address: string } }>(
    '/name-service/by-address/:address',
    async (request, reply): Promise<NameRecord[] | undefined> => {
      const lcdUrl = requireLcdUrl(reply)
      if (!lcdUrl) return undefined

      const raws = await cached(`by-address:${request.params.address}`, () =>
        fetchNamesByAddress(lcdUrl, request.params.address)
      )
      return raws.map(toNameRecord)
    }
  )

  app.get<{ Params: { steemAccount: string } }>(
    '/name-service/registrations-by-account/:steemAccount',
    async (request, reply): Promise<NameRegistration[] | undefined> => {
      const lcdUrl = requireLcdUrl(reply)
      if (!lcdUrl) return undefined

      const raws = await cached(
        `by-account:${request.params.steemAccount}`,
        () => fetchNameRegistrationsByAccount(lcdUrl, request.params.steemAccount)
      )
      return toNameRegistrations(db, raws)
    }
  )

  app.get(
    '/name-service/registrations/pending',
    async (_request, reply): Promise<NameRegistration[] | undefined> => {
      const lcdUrl = requireLcdUrl(reply)
      if (!lcdUrl) return undefined

      const page = await cached('pending', () =>
        fetchPendingNameRegistrations(lcdUrl, { limit: 100 })
      )
      return toNameRegistrations(db, page.items)
    }
  )

  app.get(
    '/name-service/registrations/awaiting',
    async (_request, reply): Promise<NameRegistration[] | undefined> => {
      const lcdUrl = requireLcdUrl(reply)
      if (!lcdUrl) return undefined

      const page = await cached('awaiting', () =>
        fetchAwaitingNameRegistrations(lcdUrl, { limit: 100 })
      )
      return toNameRegistrations(db, page.items)
    }
  )

  app.get<{ Params: { id: string } }>(
    '/name-service/registrations/:id',
    async (request, reply) => {
      const lcdUrl = requireLcdUrl(reply)
      if (!lcdUrl) return

      const raw = await cached(`registration:${request.params.id}`, () =>
        fetchNameRegistration(lcdUrl, request.params.id)
      )
      if (!raw) {
        return reply.status(404).send({ error: 'Registration not found' })
      }
      const monikers = await resolveValidatorMonikers(
        db,
        raw.validator_confirmations.map((c) => c.validator_address)
      )
      return toNameRegistration(raw, monikers)
    }
  )
}
