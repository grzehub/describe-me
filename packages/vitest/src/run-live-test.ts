import { isLiveStop, liveStatus, reportLiveStatus } from '@describe-me/core/live'
import type { LiveTestMatch } from './find-live-test.js'
import { liveErrorDetail } from './live-error-detail.js'
import { liveTestContext, type LiveTestContext } from './live-test-context.js'

/** How the arrange phase ended. A stop signal counts as an end. */
type Outcome = { kind: 'ended' } | { kind: 'failed'; error: unknown } | { kind: 'timed-out' }

/** The test's own timeout, or the nearest suite's, which Vitest passes on to its tests. */
function timeoutOf(match: LiveTestMatch, testTimeout: number): number {
  const innermostFirst = [...match.suites].reverse()
  const suiteTimeout = innermostFirst.find((suite) => suite.timeout !== undefined)?.timeout

  return match.test.timeout ?? suiteTimeout ?? testTimeout
}

async function arrange(match: LiveTestMatch, context: LiveTestContext): Promise<void> {
  for (const suite of match.suites) {
    for (const hook of suite.hooks.beforeAll) {
      await hook(context)
    }
  }

  for (const suite of match.suites) {
    for (const hook of suite.hooks.beforeEach) {
      await hook(context)
    }
  }

  await match.test.body?.(context)
}

function withTimeout(run: Promise<void>, timeout: number, onTimeout: () => void): Promise<Outcome> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      onTimeout()
      resolve({ kind: 'timed-out' })
    }, timeout)

    run.then(
      () => {
        clearTimeout(timer)
        resolve({ kind: 'ended' })
      },
      (error: unknown) => {
        clearTimeout(timer)
        resolve(isLiveStop(error) ? { kind: 'ended' } : { kind: 'failed', error })
      },
    )
  })
}

/**
 * Runs a test's arrange phase: `beforeAll` hooks from the root down, then
 * `beforeEach` hooks the same way, then the body, until the first render
 * throws the stop signal. After-hooks never run. Unless the render reported
 * `mounted`, it reports why the page shows nothing.
 */
export async function runLiveTest(match: LiveTestMatch, testTimeout: number): Promise<void> {
  const timeout = timeoutOf(match, testTimeout)
  const controller = new AbortController()
  const context = liveTestContext(match, controller.signal)
  const outcome = await withTimeout(arrange(match, context), timeout, () => controller.abort())

  if (liveStatus() !== null) {
    return
  }

  if (outcome.kind === 'timed-out') {
    reportLiveStatus('failed', `did not reach its first render within ${timeout} ms`)

    return
  }

  if (outcome.kind === 'failed') {
    reportLiveStatus('failed', liveErrorDetail(outcome.error))

    return
  }

  reportLiveStatus('no-render')
}
