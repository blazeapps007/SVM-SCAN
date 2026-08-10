import { Db } from 'mongodb'
import type { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import {
  getBaseDenom,
  type DenomMetadataResponse,
  type ResolvedDenom,
} from '@dexplorer/shared'
import {
  DENOM_METADATA_COLLECTION,
  DenomMetadataDoc,
} from '../db/schemas/denomMetadata.schema'
import {
  IBC_DENOM_TRACES_COLLECTION,
  IbcDenomTraceDoc,
} from '../db/schemas/ibcDenomTrace.schema'
import { queryIbcDenom } from '../chain/abci'

export async function getDenomMetadata(
  db: Db,
  denom: string
): Promise<DenomMetadataResponse> {
  const doc = await db
    .collection<DenomMetadataDoc>(DENOM_METADATA_COLLECTION)
    .findOne({ _id: denom })

  if (doc) {
    return {
      denom,
      displayName: doc.displayName,
      symbol: doc.symbol,
      decimals: doc.decimals,
      source: doc.source,
    }
  }

  // No curated entry — fall back to the prefix heuristic rather than
  // guessing and persisting an unverified entry.
  const base = getBaseDenom(denom)
  const decimals = denom.startsWith('u') ? 6 : denom.startsWith('a') ? 18 : 0

  return {
    denom,
    displayName: base.toUpperCase(),
    symbol: base.toUpperCase(),
    decimals,
    source: 'fallback',
  }
}

// Resolves an "ibc/<HASH>" denom to what it actually is (e.g. "uosmo" sent
// over channel-3) via the chain's own IBC transfer module — this is the
// only way to know, since the hash alone reveals nothing. Cached
// indefinitely in Mongo: a trace is permanent once established (the hash is
// a deterministic function of the path + base denom, so it can never
// change), so repeat lookups for the same denom never re-hit the chain.
async function resolveIbcTrace(
  db: Db,
  tmClient: Tendermint37Client,
  ibcDenom: string
): Promise<{ baseDenom: string; path: string } | null> {
  const collection = db.collection<IbcDenomTraceDoc>(
    IBC_DENOM_TRACES_COLLECTION
  )

  const cached = await collection.findOne({ _id: ibcDenom })
  if (cached) {
    return { baseDenom: cached.baseDenom, path: cached.path }
  }

  const hash = ibcDenom.slice('ibc/'.length)
  const trace = await queryIbcDenom(tmClient, hash)
  if (!trace) return null

  await collection.updateOne(
    { _id: ibcDenom },
    { $set: { baseDenom: trace.baseDenom, path: trace.path, resolvedAt: new Date() } },
    { upsert: true }
  )

  return trace
}

// Full display resolution for any denom (native or "ibc/..."), for contexts
// with chain access (e.g. serving account balances) that need the *real*
// symbol/decimals rather than the denom-string-only heuristic in
// getDenomMetadata. IBC denoms are resolved to their underlying base denom
// first, then that base denom's own metadata (curated entry, or the u-/a-
// prefix heuristic) is used for the actual decimals/symbol.
export async function resolveDenomForDisplay(
  db: Db,
  tmClient: Tendermint37Client,
  denom: string
): Promise<ResolvedDenom> {
  if (denom.startsWith('ibc/')) {
    try {
      const trace = await resolveIbcTrace(db, tmClient, denom)
      if (trace) {
        const baseMeta = await getDenomMetadata(db, trace.baseDenom)
        return {
          baseDenom: trace.baseDenom,
          symbol: baseMeta.symbol,
          decimals: baseMeta.decimals,
          path: trace.path,
        }
      }
    } catch (err) {
      console.error(`Failed to resolve IBC denom trace for ${denom}:`, err)
    }

    // Couldn't resolve (chain query failed, or this isn't actually a known
    // trace) — fall back to something honest rather than nothing.
    return {
      baseDenom: denom,
      symbol: denom.slice(0, 12).toUpperCase(),
      decimals: 0,
      path: null,
    }
  }

  const meta = await getDenomMetadata(db, denom)
  return {
    baseDenom: denom,
    symbol: meta.symbol,
    decimals: meta.decimals,
    path: null,
  }
}

export async function listDenomMetadata(
  db: Db
): Promise<DenomMetadataResponse[]> {
  const docs = await db
    .collection<DenomMetadataDoc>(DENOM_METADATA_COLLECTION)
    .find()
    .toArray()

  return docs.map((doc) => ({
    denom: doc._id,
    displayName: doc.displayName,
    symbol: doc.symbol,
    decimals: doc.decimals,
    source: doc.source,
  }))
}
