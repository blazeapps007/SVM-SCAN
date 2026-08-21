import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/theme/ThemeProvider'
import type { ProposalDetailResponse } from '@dexplorer/shared'
import { getTypeMsg, isBech32Address, safeStringify } from '@/utils/helper'

interface ProposalMessagesProps {
  proposal: ProposalDetailResponse
}

const stringifyField = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (typeof value === 'object') return safeStringify(value, 2)
  return String(value)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export default function ProposalMessages({ proposal }: ProposalMessagesProps) {
  const { colors } = useTheme()

  if (!proposal.messages || proposal.messages.length === 0) return null

  // Messages are already decoded server-side (see DecodeMsg in @dexplorer/shared),
  // so we just read the fields off `message.data` directly.
  const messageRows = proposal.messages.map((message) => {
    const fields = Object.entries(message.data || {}).map(([key, value]) => ({
      key,
      value,
    }))

    return {
      fields,
      type: getTypeMsg(message.typeUrl),
      typeUrl: message.typeUrl,
      raw: message.data,
    }
  })

  return (
    <div className="reference-table-shell rounded-[14px]">
      <div
        className="border-b px-5 py-[15px] text-[14px] font-semibold"
        style={{
          borderColor: colors.border.primary,
          color: colors.text.primary,
        }}
      >
        Messages ({proposal.messages.length})
      </div>

      <div className="px-5 py-[18px]">
        <div
          className="rounded-[11px] border px-[18px] py-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border.primary,
          }}
        >
          {messageRows.map((message, messageIndex) => (
            <div key={`${message.typeUrl}-${messageIndex}`}>
              <div className="mb-2 flex flex-wrap items-center gap-[10px]">
                <span
                  className="reference-pill"
                  style={{
                    backgroundColor: `${colors.primary}20`,
                    color: colors.primary,
                  }}
                >
                  {message.type}
                </span>
                <span
                  className="font-mono text-[11.5px]"
                  style={{ color: colors.text.tertiary }}
                >
                  {message.typeUrl}
                </span>
              </div>

              {message.fields.length > 0 ? (
                message.fields.map((field, fieldIndex) =>
                  isPlainObject(field.value) ? (
                    <div
                      key={`${field.key}-${fieldIndex}`}
                      className="flex flex-col gap-2 border-t py-[9px]"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <span
                        className="text-[12.5px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {field.key}
                      </span>
                      <div
                        className="flex flex-col gap-1 rounded-[8px] px-3 py-2"
                        style={{ backgroundColor: colors.backgroundSecondary }}
                      >
                        {Object.entries(field.value).map(
                          ([nestedKey, nestedValue]) => (
                            <div
                              key={nestedKey}
                              className="flex items-center justify-between gap-3 text-[12px]"
                            >
                              <span style={{ color: colors.text.tertiary }}>
                                {nestedKey}
                              </span>
                              <span
                                className="break-all font-mono text-right"
                                style={{ color: colors.text.primary }}
                              >
                                {stringifyField(nestedValue)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={`${field.key}-${fieldIndex}`}
                      className="flex flex-col justify-between gap-2 border-t py-[9px] md:flex-row md:items-start md:gap-[18px]"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <span
                        className="text-[12.5px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {field.key}
                      </span>
                      <div
                        className="font-mono text-[12.5px] break-all md:max-w-[70%] md:text-right"
                        style={{ color: colors.text.primary }}
                      >
                        {typeof field.value === 'string' &&
                        isBech32Address(field.value) ? (
                          <Link
                            to={`/accounts/${field.value}`}
                            style={{ color: colors.primary }}
                          >
                            {field.value}
                          </Link>
                        ) : (
                          stringifyField(field.value)
                        )}
                      </div>
                    </div>
                  )
                )
              ) : (
                <pre
                  className="border-t py-[9px] text-[12.5px] overflow-x-auto whitespace-pre-wrap break-words"
                  style={{
                    borderColor: colors.border.primary,
                    color: colors.text.secondary,
                  }}
                >
                  {JSON.stringify(message.raw, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
