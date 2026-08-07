import { Db } from 'mongodb'
import { getBaseDenom, type DenomMetadataResponse } from '@dexplorer/shared'
import {
  DENOM_METADATA_COLLECTION,
  DenomMetadataDoc,
} from '../db/schemas/denomMetadata.schema'

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
