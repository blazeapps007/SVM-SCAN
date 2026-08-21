import React from 'react'
import { useTheme } from '@/theme/ThemeProvider'
import ReactMarkdown from 'react-markdown'
import type { ProposalDetailResponse, proposalStatus } from '@dexplorer/shared'
import { proposalStatusList } from '@dexplorer/shared'
import { getTypeMsg, displayDate } from '@/utils/helper'

interface ProposalSummaryProps {
  proposal: ProposalDetailResponse
}

// The API stores proposal status as the raw Cosmos SDK enum name, e.g.
// "PROPOSAL_STATUS_VOTING_PERIOD". Normalize it to match proposalStatusList's
// human-readable "VOTING PERIOD" style labels.
const getStatusInfo = (status: string): proposalStatus | undefined => {
  const normalized = status.replace('PROPOSAL_STATUS_', '').replace(/_/g, ' ')
  return proposalStatusList.find(
    (item) => item.status.toUpperCase() === normalized.toUpperCase()
  )
}

export default function ProposalSummary({ proposal }: ProposalSummaryProps) {
  const { colors } = useTheme()

  const getStatusColor = (status: proposalStatus | undefined) => {
    if (!status) return colors.text.tertiary

    switch (status.status.toLowerCase()) {
      case 'passed':
        return colors.status.success
      case 'rejected':
      case 'failed':
        return colors.status.error
      case 'voting period':
        return colors.status.info
      case 'deposit period':
        return colors.status.warning
      default:
        return colors.text.tertiary
    }
  }

  const statusInfo = getStatusInfo(proposal.status)
  const statusColor = getStatusColor(statusInfo)

  const proposalType = proposal.messages.length
    ? getTypeMsg(proposal.messages[0].typeUrl)
    : 'Text Proposal'

  const votingEnd = proposal.votingEndTime
    ? displayDate(proposal.votingEndTime)
    : ''

  return (
    <div className="panel-surface flex flex-col gap-[14px] rounded-[14px] px-6 py-[22px]">
      <div className="flex items-start gap-[14px]">
        <span
          className="font-mono text-[16px] font-semibold"
          style={{ color: colors.text.tertiary }}
        >
          #{proposal.id}
        </span>
        <span
          className="flex-1 text-[19px] font-semibold leading-[1.3]"
          style={{ color: colors.text.primary }}
        >
          {proposal.title}
        </span>
        {proposal.expedited && (
          <span
            className="reference-pill"
            style={{
              backgroundColor: `${colors.status.warning}20`,
              color: colors.status.warning,
            }}
          >
            Expedited
          </span>
        )}
        <span
          className="reference-pill capitalize"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {statusInfo?.status.toLowerCase() || 'unknown'}
        </span>
      </div>

      <div className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
        {proposalType}
        {votingEnd && ` · Voting ends ${votingEnd}`}
      </div>

      {proposal.summary && (
        <div
          className="prose prose-sm max-w-none"
          style={{ color: colors.text.secondary }}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1
                  className="text-xl font-bold mb-4"
                  style={{ color: colors.text.primary }}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{ color: colors.text.primary }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  className="text-base font-medium mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p
                  className="mb-3 text-[13.5px] leading-[1.6]"
                  style={{ color: colors.text.secondary }}
                >
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul
                  className="list-disc list-inside mb-3 space-y-1"
                  style={{ color: colors.text.secondary }}
                >
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol
                  className="list-decimal list-inside mb-3 space-y-1"
                  style={{ color: colors.text.secondary }}
                >
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li style={{ color: colors.text.secondary }}>{children}</li>
              ),
              code: ({ children }) => (
                <code
                  className="px-1 py-0.5 rounded text-sm font-mono"
                  style={{
                    backgroundColor: `${colors.border.secondary}40`,
                    color: colors.text.primary,
                  }}
                >
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre
                  className="p-3 rounded-lg overflow-x-auto mb-3"
                  style={{
                    backgroundColor: `${colors.border.secondary}20`,
                    color: colors.text.primary,
                  }}
                >
                  {children}
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote
                  className="border-l-4 pl-4 mb-3 italic"
                  style={{
                    borderColor: colors.primary,
                    color: colors.text.secondary,
                  }}
                >
                  {children}
                </blockquote>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                  style={{ color: colors.primary }}
                >
                  {children}
                </a>
              ),
            }}
          >
            {proposal.summary}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
