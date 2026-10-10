import { liveStop } from '@describe-me/core/live'
import type { LiveTestMatch } from './find-live-test.js'
import { liveExport } from './live-export.js'

/** The parts of Vitest's test context that the live page offers. Fixtures are not computed. */
export interface LiveTestContext {
  task: { name: string; fullName: string }
  expect: unknown
  skip(condition?: unknown): void
  signal: AbortSignal
  onTestFinished(): void
  onTestFailed(): void
  annotate(): Promise<void>
}

function ignore(): undefined {
  return undefined
}

/**
 * The context that the hooks and the body of a live test get. `skip()` stops
 * the test without a render, so the page reports `no-render`.
 */
export function liveTestContext(match: LiveTestMatch, signal: AbortSignal): LiveTestContext {
  return {
    task: { name: match.test.name, fullName: match.path.join(' > ') },
    expect: liveExport('vitest', 'expect'),
    skip(condition?: unknown) {
      if (condition === false) {
        return
      }

      throw liveStop()
    },
    signal,
    onTestFinished: ignore,
    onTestFailed: ignore,
    annotate: () => Promise.resolve(),
  }
}
