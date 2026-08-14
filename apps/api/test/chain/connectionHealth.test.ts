import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A promise that never settles, to force a timeout deterministically.
function neverResolves<T>(): Promise<T> {
  return new Promise(() => {})
}

// The consecutive-failure counter is module-level state (see
// connectionHealth.ts) — reset the module between tests so one test's
// failures don't bleed into the next.
describe('withChainTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves normally when the promise resolves in time', async () => {
    const { withChainTimeout } = await import('../../src/chain/connectionHealth')
    await expect(
      withChainTimeout(Promise.resolve('ok'), 'test', 100)
    ).resolves.toBe('ok')
  })

  it('rejects with a timeout error but does not exit on a single timeout', async () => {
    const { withChainTimeout } = await import('../../src/chain/connectionHealth')
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    const promise = withChainTimeout(neverResolves(), 'test', 50)
    const assertion = expect(promise).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(50)
    await assertion

    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exits the process after 3 consecutive timeouts', async () => {
    const { withChainTimeout } = await import('../../src/chain/connectionHealth')
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    for (let i = 0; i < 3; i++) {
      const promise = withChainTimeout(neverResolves(), 'test', 50)
      const assertion = expect(promise).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(50)
      await assertion
    }

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('resets the consecutive-failure counter after a success', async () => {
    const { withChainTimeout } = await import('../../src/chain/connectionHealth')
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    for (let i = 0; i < 2; i++) {
      const promise = withChainTimeout(neverResolves(), 'test', 50)
      const assertion = expect(promise).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(50)
      await assertion
    }

    await withChainTimeout(Promise.resolve('ok'), 'test', 50)

    for (let i = 0; i < 2; i++) {
      const promise = withChainTimeout(neverResolves(), 'test', 50)
      const assertion = expect(promise).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(50)
      await assertion
    }

    expect(exitSpy).not.toHaveBeenCalled()
  })
})
