import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TtlCache } from '../../src/utils/ttlCache'

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined for a missing key', () => {
    const cache = new TtlCache<string>(1000)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('returns a stored value before it expires', () => {
    const cache = new TtlCache<string>(1000)
    cache.set('a', 'value')
    expect(cache.get('a')).toBe('value')
  })

  it('expires entries after the TTL elapses', () => {
    const cache = new TtlCache<string>(1000)
    cache.set('a', 'value')
    vi.advanceTimersByTime(1001)
    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts the oldest entry once the cap is exceeded', () => {
    const cache = new TtlCache<number>(1000, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('does not evict anything when overwriting an existing key', () => {
    const cache = new TtlCache<number>(1000, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 10)
    expect(cache.get('a')).toBe(10)
    expect(cache.get('b')).toBe(2)
  })
})
