import type { Db } from 'mongodb'
import type { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { getNetInfoPeers, getRpcSelfNode } from '../chain/query'
import { lookupCountry } from '../chain/geoip'
import {
  VALIDATORS_COLLECTION,
  ValidatorDoc,
} from '../db/schemas/validator.schema'

// Locates validators' nodes by country, from what our RPC node can see: its
// direct p2p peers (net_info) plus itself. A peer is tied to a validator by
// node moniker == validator moniker — true for every validator on this chain,
// but only a convention, so an unmatched validator simply stays unlocated.
// Limits: validators not peered with our RPC node can't be located, and one
// behind sentry nodes shows the sentry's country. A validator that drops out
// of the peer list keeps its last-seen country (seenAt says when).
export async function refreshNodeLocations(
  db: Db,
  tmClient: Tendermint37Client
): Promise<void> {
  const [peers, self] = await Promise.all([
    getNetInfoPeers(),
    getRpcSelfNode(tmClient),
  ])
  const ipByMoniker = new Map(
    [...peers, ...(self ? [self] : [])].map((node) => [
      node.moniker.toLowerCase(),
      node.ip,
    ])
  )
  if (ipByMoniker.size === 0) return

  // Bonded only: jailed/unbonded validators often share a moniker with the
  // operator's current, bonded one (seen live), and the running node under
  // that moniker belongs to the bonded validator.
  const collection = db.collection<ValidatorDoc>(VALIDATORS_COLLECTION)
  const validators = await collection
    .find(
      { status: 'BOND_STATUS_BONDED' },
      { projection: { operatorAddress: 1, moniker: 1 } }
    )
    .toArray()

  const seenAt = new Date()
  await Promise.all(
    validators.map(async ({ operatorAddress, moniker }) => {
      const ip = ipByMoniker.get(moniker.toLowerCase())
      if (!ip) return
      const country = await lookupCountry(ip)
      if (!country) return
      await collection.updateOne(
        { operatorAddress },
        {
          $set: {
            nodeLocation: {
              countryCode: country.code,
              countryName: country.name,
              seenAt,
            },
          },
        }
      )
    })
  )
}
