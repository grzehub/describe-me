/** A global replaced by fake timers carries its clock as `.clock`, and the clock keeps the original. */
interface FakeClock {
  _setTimeout: typeof globalThis.setTimeout
  _clearTimeout: typeof globalThis.clearTimeout
  _performance: Performance
}

type MaybeFaked<T> = T & { clock?: FakeClock }

/** The global `setTimeout`, unwrapped when a setup file faked timers before this module loaded. */
function originalSetTimeout(): typeof globalThis.setTimeout {
  const current = globalThis.setTimeout as MaybeFaked<typeof globalThis.setTimeout>

  return current.clock ? current.clock._setTimeout : current
}

/** The global `clearTimeout`, unwrapped the same way. A faked one would not clear a real timer. */
function originalClearTimeout(): typeof globalThis.clearTimeout {
  const current = globalThis.clearTimeout as MaybeFaked<typeof globalThis.clearTimeout>

  return current.clock ? current.clock._clearTimeout : current
}

/** The global `performance`, unwrapped the same way. */
function originalPerformance(): Performance {
  const current = globalThis.performance as MaybeFaked<Performance>

  return current.clock ? current.clock._performance : current
}

// Bound, because browsers throw "Illegal invocation" when `setTimeout` is
// called without its global as `this`.
const setTimeoutAtLoad = originalSetTimeout().bind(globalThis)
const clearTimeoutAtLoad = originalClearTimeout().bind(globalThis)

// Fake timers replace `performance` as a whole object, so this reference stays real.
const performanceAtLoad = originalPerformance()

/**
 * `setTimeout`, `clearTimeout` and `performance.now()` as they were before any
 * test faked them, so `vi.useFakeTimers()` neither hangs a capture nor skews
 * frame times.
 */
export const realTimers = {
  setTimeout: setTimeoutAtLoad,
  clearTimeout: clearTimeoutAtLoad,
  now: (): number => performanceAtLoad.now(),
}
