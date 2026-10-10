import { liveRegistry } from './live-registry.js'
import type { LiveSuite, LiveTest } from './live-suite.js'

/** A registered test, with the suites around it from the root down. */
export interface LiveTestMatch {
  test: LiveTest
  suites: LiveSuite[]
  /** The suite names, outermost first, then the test name. The root has no name. */
  path: string[]
}

/** Every test, depth first in registration order, the order Vitest reports them in. */
function* testsIn(
  suite: LiveSuite,
  suites: LiveSuite[],
  names: string[],
): Generator<LiveTestMatch> {
  for (const child of suite.children) {
    if (child.kind === 'test') {
      yield { test: child, suites, path: [...names, child.name] }
    } else {
      yield* testsIn(child, [...suites, child], [...names, child.name])
    }
  }
}

/**
 * The `occurrence`-th test whose suite path and name equal `path`, counted
 * 1-based over the whole file like the stable test id, or null.
 */
export function findLiveTest(path: string[], occurrence: number): LiveTestMatch | null {
  const root = liveRegistry().root
  const wanted = JSON.stringify(path)
  let seen = 0

  for (const match of testsIn(root, [root], [])) {
    if (JSON.stringify(match.path) !== wanted) {
      continue
    }

    seen += 1

    if (seen === occurrence) {
      return match
    }
  }

  return null
}
