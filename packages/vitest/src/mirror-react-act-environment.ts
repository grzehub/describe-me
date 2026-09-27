import { afterAll, beforeAll } from 'vitest'

type ActEnvironmentHost = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: unknown
  beforeAll?: unknown
  afterAll?: unknown
}

/** Testing Library's own test: its auto-cleanup block runs unless the variable is set. */
function testingLibrarySkippedItsSetup(): boolean {
  return typeof process !== 'undefined' && Boolean(process.env?.RTL_SKIP_AUTO_CLEANUP)
}

/**
 * Set React's `IS_REACT_ACT_ENVIRONMENT` flag for each test file, the way
 * Testing Library does. `RTL_SKIP_AUTO_CLEANUP` skips its whole setup block,
 * the flag included, which silences React's act warnings. The flag is set
 * only under Testing Library's own condition (Vitest globals), so the
 * warnings match a run without describe-me.
 */
export function mirrorReactActEnvironment(): void {
  const host = globalThis as ActEnvironmentHost
  const hasGlobalHooks = typeof host.beforeAll === 'function' && typeof host.afterAll === 'function'

  if (!testingLibrarySkippedItsSetup() || !hasGlobalHooks) {
    return
  }

  let previous: unknown

  beforeAll(() => {
    previous = host.IS_REACT_ACT_ENVIRONMENT
    host.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterAll(() => {
    host.IS_REACT_ACT_ENVIRONMENT = previous
  })
}
