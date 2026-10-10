import { liveRegistry } from './live-registry.js'
import type { LiveSuite } from './live-suite.js'

/**
 * Runs the factories of the registered suites once the test file has
 * imported, as Vitest collects: depth first in registration order, each one
 * awaited. A factory's own `describe` calls are collected after it returns.
 */
export async function collectLiveSuites(suite: LiveSuite = liveRegistry().root): Promise<void> {
  const registry = liveRegistry()

  for (const child of suite.children) {
    if (child.kind !== 'suite') {
      continue
    }

    if (child.factory !== undefined) {
      const previous = registry.current

      registry.current = child

      try {
        await child.factory()
      } finally {
        registry.current = previous
      }
    }

    await collectLiveSuites(child)
  }
}
