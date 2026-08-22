import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { toBase64 } from '@cosmjs/encoding'
import { bondStatusToJSON } from 'cosmjs-types/cosmos/staking/v1beta1/staking'
import { decodeLegacyDecString } from '@dexplorer/shared'
import { queryValidators } from '../chain/abci'
import {
  VALIDATORS_COLLECTION,
  ValidatorDoc,
} from '../db/schemas/validator.schema'

const PAGE_SIZE = 200

export async function refreshValidators(
  db: Db,
  tmClient: Tendermint37Client
): Promise<void> {
  const collection = db.collection<ValidatorDoc>(VALIDATORS_COLLECTION)
  const now = new Date()

  let page = 0
  for (;;) {
    const response = await queryValidators(tmClient, page, PAGE_SIZE)
    if (response.validators.length === 0) break

    await Promise.all(
      response.validators.map((validator) => {
        const consensusPubkey = validator.consensusPubkey
          ? JSON.stringify({
              typeUrl: validator.consensusPubkey.typeUrl,
              value: toBase64(validator.consensusPubkey.value),
            })
          : null

        const doc: ValidatorDoc = {
          operatorAddress: validator.operatorAddress,
          moniker: validator.description?.moniker ?? '',
          identity: validator.description?.identity ?? '',
          website: validator.description?.website ?? '',
          details: validator.description?.details ?? '',
          status: bondStatusToJSON(validator.status),
          jailed: validator.jailed,
          tokens: validator.tokens,
          // delegatorShares is a Dec (cosmjs-types/ABCI decodes it as a raw
          // fixed-point big-integer string, value * 10^18, with no decimal
          // point) that is *also* denominated in the bond token's atto
          // units — decode the Dec encoding here so the stored value is a
          // plain human-decimal atto amount, exactly like `tokens`, ready
          // for the frontend's normal atto->STEEM conversion. Skipping this
          // left shares displayed 10^18x too large (e.g. "800000000000.00B
          // STEEM" instead of "800 STEEM").
          delegatorShares: decodeLegacyDecString(validator.delegatorShares),
          commissionRate: validator.commission?.commissionRates?.rate ?? '0',
          minSelfDelegation: validator.minSelfDelegation,
          unbondingHeight: validator.unbondingHeight.toString(),
          consensusPubkey,
          uptime: null,
          lastRefreshedAt: now,
        }

        return collection.updateOne(
          { operatorAddress: doc.operatorAddress },
          { $set: doc },
          { upsert: true }
        )
      })
    )

    if (
      response.pagination?.total &&
      (page + 1) * PAGE_SIZE >= Number(response.pagination.total)
    ) {
      break
    }
    if (response.validators.length < PAGE_SIZE) break
    page += 1
  }
}
