import React from 'react'
import { useTheme } from '@/theme/ThemeProvider'
import type { ProposalDetailResponse } from '@dexplorer/shared'
import { formatAmount, getConvertedAmount } from '@dexplorer/shared'

interface VotingResultsProps {
  proposal: ProposalDetailResponse
}

// finalTallyResult's counts are bonded voting POWER (atto-denominated,
// same native-token base units as a balance), not a literal number of
// ballots cast — e.g. "104792000000000000000000" is 104,792 STEEM of
// voting power, not 104 septillion votes. Converting through Number()
// directly (as this component used to) both loses precision past
// Number.MAX_SAFE_INTEGER and displays a meaningless huge integer.
const toVotingPower = (raw: string): number =>
  Number(getConvertedAmount(raw, 'asteem').converted) || 0

const formatVotingPower = (raw: string): string =>
  `${formatAmount(getConvertedAmount(raw, 'asteem').converted)} STEEM`

export default function VotingResults({ proposal }: VotingResultsProps) {
  const { colors } = useTheme()

  if (!proposal.finalTallyResult) return null

  const yesCount = toVotingPower(proposal.finalTallyResult.yesCount)
  const noCount = toVotingPower(proposal.finalTallyResult.noCount)
  const abstainCount = toVotingPower(proposal.finalTallyResult.abstainCount)
  const noWithVetoCount = toVotingPower(
    proposal.finalTallyResult.noWithVetoCount
  )
  const totalVotes = yesCount + noCount + abstainCount + noWithVetoCount

  const calculatePercentage = (count: number) => {
    return totalVotes > 0 ? (count / totalVotes) * 100 : 0
  }

  const voteTypes = [
    {
      label: 'Yes',
      percentage: calculatePercentage(yesCount),
      formattedCount: formatVotingPower(proposal.finalTallyResult.yesCount),
      color: colors.status.success,
    },
    {
      label: 'No',
      percentage: calculatePercentage(noCount),
      formattedCount: formatVotingPower(proposal.finalTallyResult.noCount),
      color: colors.status.error,
    },
    {
      label: 'Abstain',
      percentage: calculatePercentage(abstainCount),
      formattedCount: formatVotingPower(
        proposal.finalTallyResult.abstainCount
      ),
      color: colors.text.tertiary,
    },
    {
      label: 'No w/ Veto',
      percentage: calculatePercentage(noWithVetoCount),
      formattedCount: formatVotingPower(
        proposal.finalTallyResult.noWithVetoCount
      ),
      color: colors.status.warning,
    },
  ]

  return (
    <div className="panel-surface flex flex-col gap-4 rounded-[14px] px-[22px] py-5">
      <span
        className="text-[14px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        Voting Results
      </span>

      <div
        className="flex h-3 overflow-hidden rounded-[6px]"
        style={{ backgroundColor: colors.backgroundSecondary }}
      >
        {voteTypes.map((voteType) => (
          <div
            key={voteType.label}
            style={{
              width: `${voteType.percentage}%`,
              backgroundColor: voteType.color,
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {voteTypes.map((voteType) => (
          <div
            key={voteType.label}
            className="flex flex-col gap-1.5 rounded-[10px] border px-[15px] py-[13px]"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border.primary,
            }}
          >
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: colors.text.secondary }}
            >
              <span
                className="h-[9px] w-[9px] rounded-[2px]"
                style={{ backgroundColor: voteType.color }}
              />
              {voteType.label}
            </span>
            <span
              className="font-mono text-[18px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {voteType.percentage.toFixed(1)}%
            </span>
            <span
              className="font-mono text-[11.5px]"
              style={{ color: colors.text.tertiary }}
            >
              {voteType.formattedCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
