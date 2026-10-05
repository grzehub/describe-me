type ActEnvironmentHost = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: unknown }

/**
 * Waits can overlap, for example an un-awaited interaction or `flush()` with
 * captures in flight. The flag from before the first one comes back when the
 * last one ends.
 */
let depth = 0
let previous: unknown

/**
 * Run a recorder wait with React's `IS_REACT_ACT_ENVIRONMENT` flag off, as
 * Testing Library's `asyncWrapper` does for `waitFor` and user-event. Otherwise
 * an update that lands in the wait logs an act warning that a run without
 * describe-me never shows.
 */
export async function actNeutralWait(wait: () => Promise<void>): Promise<void> {
  const host = globalThis as ActEnvironmentHost

  if (depth === 0) {
    previous = host.IS_REACT_ACT_ENVIRONMENT
    host.IS_REACT_ACT_ENVIRONMENT = false
  }

  depth++

  try {
    await wait()
  } finally {
    depth--

    if (depth === 0) {
      host.IS_REACT_ACT_ENVIRONMENT = previous
    }
  }
}
