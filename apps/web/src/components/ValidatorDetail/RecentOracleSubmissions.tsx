import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/theme/ThemeProvider'
import { timeFromNow, trimHash } from '@/utils/helper'
import { useValidatorOracleSubmissions } from '@/hooks/useValidatorExtras'

interface RecentOracleSubmissionsProps {
  identity: string
}

export default function RecentOracleSubmissions({
  identity,
}: RecentOracleSubmissionsProps) {
  const { colors } = useTheme()
  const { submissions, isLoading } = useValidatorOracleSubmissions(identity)

  return (
    <div className="panel-surface flex flex-col gap-3 rounded-[14px] px-6 py-5">
      <span
        className="text-[14px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        Recent Oracle Submissions
      </span>

      {isLoading ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          Loading...
        </p>
      ) : submissions.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: colors.text.tertiary }}>
          No oracle vote/prevote submissions from this validator yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {submissions.map((submission) => (
            <Link
              key={submission.hash}
              to={`/tx/${submission.hash}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-4 py-3 hover:opacity-80"
              style={{ borderColor: colors.border.primary }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="reference-pill"
                  style={{
                    backgroundColor: `${colors.primary}20`,
                    color: colors.primary,
                  }}
                >
                  {submission.kind === 'vote' ? 'Oracle Vote' : 'Oracle Prevote'}
                </span>
                <span
                  className="font-mono text-[12px]"
                  style={{ color: colors.text.secondary }}
                  title={submission.hash}
                >
                  {trimHash(submission.hash, 10)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="reference-pill"
                  style={{
                    backgroundColor: submission.success
                      ? `${colors.status.success}20`
                      : `${colors.status.error}20`,
                    color: submission.success
                      ? colors.status.success
                      : colors.status.error,
                  }}
                >
                  {submission.success ? 'Success' : 'Failed'}
                </span>
                <span
                  className="text-[11.5px]"
                  style={{ color: colors.text.tertiary }}
                >
                  {timeFromNow(submission.timestamp)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
