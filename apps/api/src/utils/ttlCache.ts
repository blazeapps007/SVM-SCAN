// A small TTL cache with a hard size cap. Several routes cache short-lived,
// per-key responses (account balances, EVM tx details, name-service
// lookups, validator uptime) — a plain Map keyed by an unbounded input
// (addresses, tx hashes, search terms) only ever grows, since entries are
// merely overwritten on repeat access to the *same* key, never evicted.
// Over a long-running process with varied traffic that's an unbounded
// memory leak. Eviction here is FIFO (oldest-inserted first) via Map's
// iteration order — not true LRU, but simple and enough to put a hard
// ceiling on memory use.
export class TtlCache<T> {
  private store = new Map<string, { fetchedAt: number; data: T }>()

  constructor(
    private ttlMs: number,
    private maxEntries: number = 500
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key)
    if (!hit) return undefined
    if (Date.now() - hit.fetchedAt > this.ttlMs) {
      this.store.delete(key)
      return undefined
    }
    return hit.data
  }

  set(key: string, data: T): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey)
      }
    }
    this.store.set(key, { fetchedAt: Date.now(), data })
  }
}
