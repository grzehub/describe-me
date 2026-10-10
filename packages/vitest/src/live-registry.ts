import { liveSuite, type LiveSuite } from './live-suite.js'

/** The suites, tests and hooks of the test file on the live page. */
export interface LiveRegistry {
  root: LiveSuite
  /** Where suites, tests and hooks register: the suite whose factory runs, or the root during import. */
  current: LiveSuite
}

const REGISTRY_KEY = Symbol.for('describe-me.live-registry')

type GlobalWithRegistry = typeof globalThis & { [REGISTRY_KEY]?: LiveRegistry }

/**
 * The registry of the live page. The shimmed `vitest` and the runner may come
 * from two copies of this package, so it lives on `globalThis`.
 */
export function liveRegistry(): LiveRegistry {
  const scope = globalThis as GlobalWithRegistry

  if (scope[REGISTRY_KEY] === undefined) {
    const root = liveSuite('')

    scope[REGISTRY_KEY] = { root, current: root }
  }

  return scope[REGISTRY_KEY]
}
