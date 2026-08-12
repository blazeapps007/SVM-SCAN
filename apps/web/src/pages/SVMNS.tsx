import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiAtSign, FiSearch } from 'react-icons/fi'
import type { NameRegistration } from '@dexplorer/shared'
import { useTheme } from '@/theme/ThemeProvider'
import { isBech32Address, trimHash, displayDate } from '@/utils/helper'
import {
  useResolveName,
  useNamesByAddress,
  useNameRegistrationsByAccount,
  usePendingNameRegistrations,
  useAwaitingNameRegistrations,
} from '@/hooks/useNameService'
import { ThemeColors } from '@/theme/colors'

const getStatusColor = (status: string, colors: ThemeColors): string => {
  if (status.includes('ACTIVE')) return colors.status.success
  if (status.includes('PENDING') || status.includes('AWAITING'))
    return colors.status.warning
  if (status.includes('EXPIRED') || status.includes('SUPERSEDED'))
    return colors.status.error
  return colors.text.secondary
}

const formatStatusLabel = (status: string): string => {
  const stripped = status.replace('NAME_REGISTRATION_STATUS_', '')
  return stripped.charAt(0) + stripped.slice(1).toLowerCase()
}

const formatSteemTimestamp = (raw: string): string =>
  raw === 'genesis' ? 'Genesis' : displayDate(raw)

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const { colors } = useTheme()
  const color = getStatusColor(status, colors)
  return (
    <span
      className="reference-pill"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {formatStatusLabel(status)}
    </span>
  )
}

const RegistrationRow: React.FC<{ registration: NameRegistration }> = ({
  registration,
}) => {
  const { colors } = useTheme()
  return (
    <tr className="reference-table-row border-b" style={{ borderColor: colors.border.primary }}>
      <td className="px-5 py-4">
        <Link
          to={`/svmns/registrations/${registration.id}`}
          className="text-sm font-semibold hover:opacity-70 transition-opacity"
          style={{ color: colors.primary }}
        >
          {registration.steemAccount}
        </Link>
      </td>
      <td className="px-5 py-4">
        <span className="font-mono text-xs" style={{ color: colors.text.secondary }}>
          {trimHash(registration.derivedDestination, 8)}
        </span>
      </td>
      <td className="px-5 py-4">
        <StatusPill status={registration.status} />
      </td>
      <td className="px-5 py-4 text-right">
        <span className="text-sm" style={{ color: colors.text.secondary }}>
          {formatSteemTimestamp(registration.steemTimestamp)}
        </span>
      </td>
    </tr>
  )
}

const RegistrationTable: React.FC<{
  title: string
  registrations: NameRegistration[]
  emptyText: string
}> = ({ title, registrations, emptyText }) => {
  const { colors } = useTheme()
  return (
    <div className="reference-table-shell">
      <div className="px-5 py-4">
        <h2 className="font-heading text-base font-semibold" style={{ color: colors.text.primary }}>
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: colors.border.primary }}>
              <th className="reference-table-header px-5 py-4 text-left">Steem Account</th>
              <th className="reference-table-header px-5 py-4 text-left">Destination</th>
              <th className="reference-table-header px-5 py-4 text-left">Status</th>
              <th className="reference-table-header px-5 py-4 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <RegistrationRow key={r.id} registration={r} />
            ))}
          </tbody>
        </table>
        {registrations.length === 0 && (
          <div className="py-8 text-center text-sm" style={{ color: colors.text.tertiary }}>
            {emptyText}
          </div>
        )}
      </div>
    </div>
  )
}

const SVMNS: React.FC = () => {
  const { colors } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [activeQuery, setActiveQuery] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setInput(q)
    setActiveQuery(q)
    // Only re-sync when the URL's ?q= changes (e.g. back/forward nav) — not
    // on every render, since setSearchParams below would otherwise loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('q')])

  const isAddressSearch = activeQuery ? isBech32Address(activeQuery) : false

  const { record: resolvedRecord, isLoading: resolveLoading } = useResolveName(
    !isAddressSearch && activeQuery ? activeQuery : undefined
  )
  const { registrations: history, isLoading: historyLoading } =
    useNameRegistrationsByAccount(
      !isAddressSearch && activeQuery ? activeQuery : undefined
    )
  const { records: ownedNames, isLoading: byAddressLoading } =
    useNamesByAddress(isAddressSearch ? activeQuery : undefined)

  const { registrations: pending } = usePendingNameRegistrations()
  const { registrations: awaiting } = useAwaitingNameRegistrations()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    setSearchParams(trimmed ? { q: trimmed } : {})
    setActiveQuery(trimmed)
  }

  return (
    <div className="space-y-5">
      <div className="panel-surface rounded-[14px] px-6 py-[22px]">
        <div className="mb-4 flex items-center gap-2">
          <FiAtSign className="h-5 w-5" style={{ color: colors.primary }} />
          <h1 className="font-heading text-xl font-semibold" style={{ color: colors.text.primary }}>
            SVMNS — Steem Virtual Machine Name Service
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search a Steem username or an SVM address..."
            className="flex-1 rounded-[8px] border px-4 py-2 text-sm outline-none"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border.primary,
              color: colors.text.primary,
            }}
          />
          <button
            type="submit"
            className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: colors.primary, color: colors.background }}
          >
            <FiSearch className="h-4 w-4" />
            Search
          </button>
        </form>
      </div>

      {activeQuery && !isAddressSearch && (
        <div className="panel-surface rounded-[14px] px-6 py-[22px]">
          {resolveLoading ? (
            <p style={{ color: colors.text.secondary }}>Resolving...</p>
          ) : resolvedRecord ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm" style={{ color: colors.text.tertiary }}>
                {resolvedRecord.steemAccount} currently resolves to
              </p>
              <p className="font-mono text-lg font-semibold" style={{ color: colors.text.primary }}>
                {resolvedRecord.address}
              </p>
            </div>
          ) : (
            <p style={{ color: colors.text.secondary }}>
              "{activeQuery}" has no active name link.
            </p>
          )}

          {!historyLoading && history.length > 0 && (
            <div className="mt-6">
              <RegistrationTable
                title="Registration History"
                registrations={history}
                emptyText="No registrations found"
              />
            </div>
          )}
        </div>
      )}

      {activeQuery && isAddressSearch && (
        <div className="panel-surface rounded-[14px] px-6 py-[22px]">
          <p className="mb-3 text-sm" style={{ color: colors.text.tertiary }}>
            Names owned by {trimHash(activeQuery, 10)}
          </p>
          {byAddressLoading ? (
            <p style={{ color: colors.text.secondary }}>Loading...</p>
          ) : ownedNames.length === 0 ? (
            <p style={{ color: colors.text.secondary }}>No names found for this address.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ownedNames.map((n) => (
                <Link
                  key={n.registrationId}
                  to={`/svmns?q=${encodeURIComponent(n.steemAccount)}`}
                  className="rounded-[8px] px-4 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: colors.backgroundSecondary, color: colors.primary }}
                >
                  {n.steemAccount}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <RegistrationTable
        title="Pending Registrations"
        registrations={pending}
        emptyText="No registrations currently pending"
      />
      <RegistrationTable
        title="Awaiting Confirmation"
        registrations={awaiting}
        emptyText="No registrations currently awaiting confirmation"
      />
    </div>
  )
}

export default SVMNS
