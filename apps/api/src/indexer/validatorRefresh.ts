import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { toBase64 } from '@cosmjs/encoding'
import { bondStatusToJSON } from 'cosmjs-types/cosmos/staking/v1beta1/staking'
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
          tokens: validator.tokens,
          delegatorShares: validator.delegatorShares,
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
