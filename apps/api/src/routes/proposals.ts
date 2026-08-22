import type { FastifyInstance } from 'fastify'
import type {
  ProposalDetailResponse,
  ProposalStats,
  ProposalSummary,
  ProposalVote,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
import { env } from '../config/env'
import { fetchProposalVotes } from '../chain/govLcd'
import { accountToValoperAddress } from '../chain/helpers'
import { resolveValidatorMonikers } from '../db/validatorLookup'
import {
  PROPOSALS_COLLECTION,
  ProposalDoc,
} from '../db/schemas/proposal.schema'
import {
  parsePagination,
  paginatedResponse,
  type PageQuery,
} from '../utils/pagination'

function toSummary(doc: ProposalDoc): ProposalSummary {
  return {
    id: doc.id,
    title: doc.title,
    status: doc.status,
    votingStartTime: doc.votingStartTime
      ? doc.votingStartTime.toISOString()
      : null,
    votingEndTime: doc.votingEndTime ? doc.votingEndTime.toISOString() : null,
    submitTime: doc.submitTime ? doc.submitTime.toISOString() : null,
  }
}

export function registerProposalRoutes(
  app: FastifyInstance,
  { db }: AppContext
): void {
  const collection = db.collection<ProposalDoc>(PROPOSALS_COLLECTION)

  app.get<{ Querystring: PageQuery }>('/proposals', async (request) => {
    const { page, perPage, skip } = parsePagination(request.query, 10)

    const [docs, total] = await Promise.all([
      collection.find().sort({ id: -1 }).skip(skip).limit(perPage).toArray(),
      collection.countDocuments(),
    ])

    return paginatedResponse(docs.map(toSummary), page, perPage, total)
  })

  app.get('/proposals/stats', async (): Promise<ProposalStats> => {
    const [total, activeVoting, passed] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ status: 'PROPOSAL_STATUS_VOTING_PERIOD' }),
      collection.countDocuments({ status: 'PROPOSAL_STATUS_PASSED' }),
    ])
    return { total, activeVoting, passed }
  })

  app.get<{ Params: { id: string } }>(
    '/proposals/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'Invalid proposal id' })
      }

      const doc = await collection.findOne({ id })
      if (!doc) {
        return reply.status(404).send({ error: 'Proposal not found' })
      }

      const response: ProposalDetailResponse = {
        ...toSummary(doc),
        summary: doc.summary,
        proposer: doc.proposer,
        depositEndTime: doc.depositEndTime
          ? doc.depositEndTime.toISOString()
          : null,
        totalDeposit: doc.totalDeposit,
        finalTallyResult: doc.finalTallyResult,
        messages: doc.messages as ProposalDetailResponse['messages'],
        expedited: doc.expedited,
        failedReason: doc.failedReason,
      }
      return response
    }
  )

  // Live proxy, not indexed — see fetchProposalVotes's doc comment for why
  // (the gov module prunes individual votes once a proposal concludes, so
  // there's no durable history to index the same way finalTallyResult is).
  app.get<{ Params: { id: string }; Querystring: PageQuery }>(
    '/proposals/:id/votes',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      if (Number.isNaN(id)) {
        return reply.status(400).send({ error: 'Invalid proposal id' })
      }
      if (!env.STEEMBRIDGE_LCD_URL) {
        return reply.status(503).send({ error: 'Proposal votes unavailable' })
      }

      const { page, perPage, skip } = parsePagination(request.query, 25)
      const { votes, total } = await fetchProposalVotes(
        env.STEEMBRIDGE_LCD_URL,
        id,
        skip,
        perPage
      )

      // A vote's `voter` is a plain account address — re-prefix each to its
      // valoper form and batch-resolve against our indexed validators, so a
      // validator voting with its self-delegator account shows its moniker
      // instead of a bare address (same re-prefixing trick routes/accounts.ts
      // and db/validatorLookup.ts already use for MsgAttestDeposit's
      // "validator" field).
      const valoperAddresses = votes
        .map((vote) => accountToValoperAddress(vote.voter))
        .filter((address): address is string => address !== null)
      const monikers = await resolveValidatorMonikers(db, valoperAddresses)

      const data: ProposalVote[] = votes.map((vote) => {
        const valoperAddress = accountToValoperAddress(vote.voter)
        return {
          voter: vote.voter,
          options: vote.options.map((option) => ({
            option: option.option,
            weight: option.weight,
          })),
          moniker: valoperAddress
            ? (monikers.get(valoperAddress) ?? null)
            : null,
        }
      })

      return paginatedResponse(data, page, perPage, total)
    }
  )
}
