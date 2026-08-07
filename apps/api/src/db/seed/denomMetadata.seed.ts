import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { queryDenomsMetadata } from '../../chain/abci'
import {
  DENOM_METADATA_COLLECTION,
  DenomMetadataDoc,
} from '../schemas/denomMetadata.schema'

const PAGE_SIZE = 100

// Denom display metadata (decimals, display name, symbol) is registered
// on-chain by the bank module — pull it from there rather than guessing.
// Runs on every indexer startup and fully replaces the auto-synced set, so
// denoms removed/renamed on-chain don't linger as stale local entries.
// Anything not covered here (e.g. an IBC denom the chain hasn't locally
// registered metadata for) falls back to the u-/a-prefix decimals heuristic
// at read time in `indexer/denomRegistry.ts`.
export async function syncDenomMetadataFromChain(
  db: Db,
  tmClient: Tendermint37Client
): Promise<void> {
  const collection = db.collection<DenomMetadataDoc>(DENOM_METADATA_COLLECTION)
  const now = new Date()
  const docs: DenomMetadataDoc[] = []

  let page = 0
  for (;;) {
    const response = await queryDenomsMetadata(tmClient, page, PAGE_SIZE)
    if (response.metadatas.length === 0) break

    for (const metadata of response.metadatas) {
      if (!metadata.base) continue

      const displayUnit = metadata.denomUnits.find(
        (unit) => unit.denom === metadata.display
      )
      const decimals =
        displayUnit?.exponent ??
        metadata.denomUnits.reduce(
          (max, unit) => Math.max(max, unit.exponent),
          0
        )

      docs.push({
        _id: metadata.base,
        displayName: metadata.name || metadata.display || metadata.base,
        symbol:
          metadata.symbol || metadata.display?.toUpperCase() || metadata.base,
        decimals,
        source: 'seed',
        updatedAt: now,
      })
    }

    if (
      response.pagination?.total &&
      (page + 1) * PAGE_SIZE >= Number(response.pagination.total)
    ) {
      break
    }
    if (response.metadatas.length < PAGE_SIZE) break
    page += 1
  }

  await collection.deleteMany({ source: 'seed' })
  if (docs.length > 0) {
    await collection.insertMany(docs)
  }
}
