import type { Paginated } from '@dexplorer/shared'

export interface PageQuery {
  page?: string
  perPage?: string
}

export function parsePagination(
  query: PageQuery,
  defaultPerPage: number,
  maxPerPage = 200
): { page: number; perPage: number; skip: number } {
  const page = Math.max(0, parseInt(query.page ?? '0', 10) || 0)
  const perPage = Math.min(
    maxPerPage,
    Math.max(
      1,
      parseInt(query.perPage ?? String(defaultPerPage), 10) || defaultPerPage
    )
  )
  return { page, perPage, skip: page * perPage }
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  perPage: number,
  total: number
): Paginated<T> {
  return { data, pagination: { page, perPage, total } }
}
