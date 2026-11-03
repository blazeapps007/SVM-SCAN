import React, { useState } from 'react'
import { useTheme } from '@/theme/ThemeProvider'

interface CountryFlagProps {
  // ISO 3166-1 alpha-2, e.g. "FR"
  code: string
  title?: string
  className?: string
}

// An image rather than a regional-indicator emoji: Windows (Chrome/Edge)
// renders emoji flags as plain letter pairs. Falls back to the code itself
// if the image can't load.
const CountryFlag: React.FC<CountryFlagProps> = ({
  code,
  title,
  className = '',
}) => {
  const { colors } = useTheme()
  const [failed, setFailed] = useState(false)
  const lower = code.toLowerCase()

  if (failed || !/^[a-z]{2}$/.test(lower)) {
    return (
      <span
        title={title}
        className={`font-mono text-[10px] font-semibold ${className}`}
        style={{ color: colors.text.tertiary }}
      >
        {code.toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w20/${lower}.png`}
      srcSet={`https://flagcdn.com/w40/${lower}.png 2x`}
      width={20}
      height={15}
      alt={title ?? code}
      title={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 rounded-[2px] object-cover ${className}`}
      style={{ border: `1px solid ${colors.border.primary}` }}
    />
  )
}

export default CountryFlag
