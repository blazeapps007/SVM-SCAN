import { config } from '@/config'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
}
