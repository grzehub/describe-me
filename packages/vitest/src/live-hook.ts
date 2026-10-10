import { liveRegistry } from './live-registry.js'
import type { LiveCallback, LiveHookKind } from './live-suite.js'

/**
 * `beforeAll`, `beforeEach`, `afterEach` or `afterAll` on the live page. The
 * hook registers on the suite whose factory runs, or on the root during import.
 */
export function liveHook(kind: LiveHookKind): (hook: LiveCallback) => void {
  return (hook) => {
    liveRegistry().current.hooks[kind].push(hook)
  }
}
