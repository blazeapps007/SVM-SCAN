import { describe, expect, it } from 'vitest'
import { parsePagination, paginatedResponse } from '../../src/utils/pagination'

describe('parsePagination', () => {
  it('applies defaults when no query params are given', () => {
    expect(parsePagination({}, 50)).toEqual({ page: 0, perPage: 50, skip: 0 })
  })

  it('parses page/perPage and computes skip', () => {
    expect(parsePagination({ page: '2', perPage: '10' }, 50)).toEqual({
      page: 2,
      perPage: 10,
      skip: 20,
    })
  })

  it('clamps perPage to the max and page to non-negative', () => {
    expect(parsePagination({ page: '-5', perPage: '9999' }, 50, 100)).toEqual({
      page: 0,
      perPage: 100,
      skip: 0,
    })
  })

  it('falls back to defaults for non-numeric input', () => {
    expect(parsePagination({ page: 'abc', perPage: 'xyz' }, 25)).toEqual({
      page: 0,
      perPage: 25,
      skip: 0,
    })
  })
})

describe('paginatedResponse', () => {
  it('wraps data with a pagination envelope', () => {
    expect(paginatedResponse([1, 2, 3], 0, 10, 3)).toEqual({
      data: [1, 2, 3],
      pagination: { page: 0, perPage: 10, total: 3 },
    })
  })
})
