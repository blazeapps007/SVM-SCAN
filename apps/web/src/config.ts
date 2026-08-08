// Configuration for the application
// Environment variables are injected by Vite at build time (import.meta.env)

const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return ''

  const trimmedValue = value.trim()
  if (
    !trimmedValue ||
    trimmedValue === 'undefined' ||
    trimmedValue === 'null'
  ) {
    return ''
  }

  return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue
}

export const config = {
  // Base URL of the SVM Scan REST API (apps/api)
  apiBaseUrl:
    normalizeEnvValue(import.meta.env.VITE_API_BASE_URL) ||
    'http://localhost:4000/api',
}
