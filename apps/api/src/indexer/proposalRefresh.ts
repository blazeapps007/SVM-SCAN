import { Db } from 'mongodb'
import { Tendermint37Client } from '@cosmjs/tendermint-rpc'
import { proposalStatusToJSON } from 'cosmjs-types/cosmos/gov/v1/gov'
import { decodeMsg } from '@dexplorer/shared'
import { queryProposals, queryTallyResult } from '../chain/abci'
import {
  PROPOSALS_COLLECTION,
  ProposalDoc,
} from '../db/schemas/proposal.schema'

const PAGE_SIZE = 100

// Statuses where voting has concluded and the proposal's own stored
// finalTallyResult is authoritative (votes may be pruned from the store
// after this point, so re-querying the live tally is not reliable here).
const CONCLUDED_STATUSES = new Set([
  'PROPOSAL_STATUS_PASSED',
  'PROPOSAL_STATUS_REJECTED',
  'PROPOSAL_STATUS_FAILED',
])

function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function refreshProposals(
  db: Db,
  tmClient: Tendermint37Client
): Promise<void> {
  const collection = db.collection<ProposalDoc>(PROPOSALS_COLLECTION)
  const now = new Date()

  let page = 0
  for (;;) {
    const response = await queryProposals(tmClient, page, PAGE_SIZE)
    if (response.proposals.length === 0) break

    await Promise.all(
      response.proposals.map(async (proposal) => {
        const status = proposalStatusToJSON(proposal.status)
        const id = Number(proposal.id)

        // While a proposal is still in its deposit/voting period,
        // `proposal.finalTallyResult` is all zeros — fetch the live,
        // on-demand tally instead (same data `<chaind> query gov tally`
        // returns). Once concluded, trust the proposal's own stored result.
        let tally = proposal.finalTallyResult ?? null
        if (!CONCLUDED_STATUSES.has(status)) {
          try {
            const tallyResponse = await queryTallyResult(tmClient, id)
            if (tallyResponse.tally) {
              tally = tallyResponse.tally
            }
          } catch (err) {
            console.error(`Failed to fetch live tally for proposal ${id}:`, err)
          }
        }

        const doc: ProposalDoc = {
          id,
          title: proposal.title,
          summary: proposal.summary,
          status,
          proposer: proposal.proposer,
          messages: proposal.messages.map((msg) =>
            decodeMsg(msg.typeUrl, msg.value)
          ),
          submitTime: toDate(proposal.submitTime),
          depositEndTime: toDate(proposal.depositEndTime),
          votingStartTime: toDate(proposal.votingStartTime),
          votingEndTime: toDate(proposal.votingEndTime),
          totalDeposit: proposal.totalDeposit.map((coin) => ({
            denom: coin.denom,
            amount: coin.amount,
          })),
          finalTallyResult: tally
            ? {
                yesCount: tally.yesCount,
                noCount: tally.noCount,
                abstainCount: tally.abstainCount,
                noWithVetoCount: tally.noWithVetoCount,
              }
            : null,
          lastRefreshedAt: now,
        }

        await collection.updateOne(
          { id: doc.id },
          { $set: doc },
          { upsert: true }
        )
      })
    )

    if (response.proposals.length < PAGE_SIZE) break
    page += 1
  }
}
