import { Db } from 'mongodb'
import { VALIDATORS_COLLECTION, ValidatorDoc } from './schemas/validator.schema'
import { accountToValoperAddress } from '../chain/helpers'

// Batched operatorAddress -> moniker resolution, for enriching a page of
// bridge-deposit oracle confirmations (which are already valoper addresses)
// in a single query instead of one findOne() per confirmation.
export async function resolveValidatorMonikers(
  db: Db,
  operatorAddresses: readonly string[]
): Promise<Map<string, string>> {
  const uniqueAddresses = [...new Set(operatorAddresses)]
  if (uniqueAddresses.length === 0) return new Map()

  const docs = await db
    .collection<ValidatorDoc>(VALIDATORS_COLLECTION)
    .find(
      { operatorAddress: { $in: uniqueAddresses } },
      { projection: { operatorAddress: 1, moniker: 1 } }
    )
    .toArray()

  return new Map(docs.map((doc) => [doc.operatorAddress, doc.moniker]))
}

// Resolves a single address to a moniker, accepting either a valoper
// address directly or a plain account address (re-prefixed via
// accountToValoperAddress first) — used for the one-off MsgSubmitSteemDeposit
// "validator" field on the transaction detail page, which is account-form.
export async function resolveValidatorMoniker(
  db: Db,
  address: string
): Promise<string | null> {
  const operatorAddress = address.includes('valoper')
    ? address
    : accountToValoperAddress(address)
  if (!operatorAddress) return null

  const doc = await db
    .collection<ValidatorDoc>(VALIDATORS_COLLECTION)
    .findOne(
      { operatorAddress },
      { projection: { operatorAddress: 1, moniker: 1 } }
    )
  return doc?.moniker ?? null
}
