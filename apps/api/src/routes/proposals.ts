import type { FastifyInstance } from 'fastify'
import type {
  ProposalDetailResponse,
  ProposalStats,
  ProposalSummary,
} from '@dexplorer/shared'
import type { AppContext } from '../server'
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
}
