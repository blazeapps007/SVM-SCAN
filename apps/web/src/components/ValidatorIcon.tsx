import React, { useEffect, useState } from 'react'
import { useTheme } from '@/theme/ThemeProvider'
import { FiUser } from 'react-icons/fi'
import { fetchWithTimeout } from '@/utils/helper'

interface ValidatorIconProps {
  identity?: string
  moniker: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Validator monikers on this chain are Steem account names, not arbitrary
// display strings — verified live: monikers like "blaze.apps"/
// "xpilar.witness" match real Steem accounts, whose own
// description.details even embeds that account's STM-prefixed
// owner/active/posting keys. steemitimages.com's avatar proxy is keyed by
// exactly this name, so it's tried first — far more likely to have
// something set than Keybase (`identity`), which is empty on every
// validator observed on this chain so far. For an unknown/invalid account
// name, steemitimages responds 200 with a JSON error body rather than an
// image (confirmed live), which the browser correctly can't decode and
// fires onError for — so falling back from there to Keybase, and finally
// to the initial-letter placeholder, works the same way the old
// Keybase-only version did.
const ValidatorIcon: React.FC<ValidatorIconProps> = ({
  identity,
  moniker,
  size = 'md',
  className = '',
}) => {
  const { colors } = useTheme()
  const [steemAvatarFailed, setSteemAvatarFailed] = useState(false)
  const [keybaseImageUrl, setKeybaseImageUrl] = useState<string | null>(null)
  const [keybaseFailed, setKeybaseFailed] = useState(false)

  const sizeClass = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-sm',
  }

  useEffect(() => {
    setSteemAvatarFailed(false)
    setKeybaseImageUrl(null)
    setKeybaseFailed(false)
  }, [moniker])

  // Only reached once the Steem avatar has failed — for the current
  // validator set that's either an empty moniker or one that isn't a real
  // Steem account, both rare, so there's no need for the old
  // IntersectionObserver-gated lazy fetch.
  useEffect(() => {
    if (!steemAvatarFailed || !identity) return

    let isMounted = true

    const fetchIcon = async () => {
      try {
        const response = await fetchWithTimeout(
          `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${identity}&fields=pictures`
        )
        const data = await response.json()

        if (
          isMounted &&
          data.status.name === 'OK' &&
          data.them?.[0]?.pictures?.primary?.url
        ) {
          setKeybaseImageUrl(data.them[0].pictures.primary.url)
        } else if (isMounted) {
          setKeybaseFailed(true)
        }
      } catch (error) {
        if (isMounted) {
          console.warn('Failed to fetch validator icon:', error)
          setKeybaseFailed(true)
        }
      }
    }

    fetchIcon()

    return () => {
      isMounted = false
    }
  }, [identity, steemAvatarFailed])

  if (moniker && !steemAvatarFailed) {
    return (
      <img
        src={`https://steemitimages.com/u/${moniker.toLowerCase()}/avatar/small`}
        alt={moniker}
        loading="lazy"
        className={`rounded-full object-cover ${sizeClass[size]} ${className}`}
        onError={() => setSteemAvatarFailed(true)}
        style={{
          border: `1px solid ${colors.border.primary}`,
        }}
      />
    )
  }

  if (keybaseImageUrl && !keybaseFailed) {
    return (
      <img
        src={keybaseImageUrl}
        alt={moniker}
        loading="lazy"
        className={`rounded-full object-cover ${sizeClass[size]} ${className}`}
        onError={() => setKeybaseFailed(true)}
        style={{
          border: `1px solid ${colors.border.primary}`,
        }}
      />
    )
  }

  // Fallback to initial
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold ${sizeClass[size]} ${className}`}
      style={{
        backgroundColor: colors.primary + '20',
        color: colors.primary,
        border: `1px solid ${colors.primary}40`,
      }}
    >
      {moniker ? moniker.charAt(0).toUpperCase() : <FiUser />}
    </div>
  )
}

export default ValidatorIcon
