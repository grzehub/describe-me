import { isLiveStop, liveStatus, reportLiveStatus } from '@describe-me/core/live'
import type { LiveTestMatch } from './find-live-test.js'
import { liveErrorDetail } from './live-error-detail.js'
import type { LiveFixtureUse } from './live-fixture-props.js'
import type { LiveFixture } from './live-fixture-registrations.js'
import { liveFixtureValues } from './live-fixture-values.js'
import type { LiveSuite } from './live-suite.js'
import { liveTestContext, type LiveTestContext } from './live-test-context.js'

/** How the arrange phase ended. A stop signal counts as an end. */
type Outcome = { kind: 'ended' } | { kind: 'failed'; error: unknown } | { kind: 'timed-out' }

/** The rest of the arrange phase from one point on. */
type Step = () => Promise<void>

/** An around hook, with all its arguments but the run function. */
type AroundCall = (run: () => Promise<never>) => unknown

type AroundKind = 'aroundAll' | 'aroundEach'

const RUN_FUNCTIONS: Record<AroundKind, string> = { aroundAll: 'runSuite', aroundEach: 'runTest' }

/** What the steps of one arrange phase share. */
interface Arrange {
  match: LiveTestMatch
  context: LiveTestContext
  /** The fixtures computed so far, each once per page. */
  computed: Set<LiveFixture>
}

/** The test's own timeout, or the nearest suite's, which Vitest passes on to its tests. */
function timeoutOf(match: LiveTestMatch, testTimeout: number): number {
  const innermostFirst = [...match.suites].reverse()
  const suiteTimeout = innermostFirst.find((suite) => suite.timeout !== undefined)?.timeout

  return match.test.timeout ?? suiteTimeout ?? testTimeout
}

/** Computes the fixtures that a test-scope callback uses, then calls it. */
async function withFixtures(
  arrange: Arrange,
  use: LiveFixtureUse | null,
  call: () => unknown,
): Promise<void> {
  await liveFixtureValues(arrange.match.test.fixtures, use, arrange.context, arrange.computed)
  await call()
}

/**
 * Runs one around hook. Its run function starts `inner` and returns a
 * promise that never settles, so the hook's teardown never runs. Settles as
 * `inner` does, or rejects when the hook fails or settles without calling
 * its run function.
 */
function around(kind: AroundKind, call: AroundCall, inner: Step): Promise<void> {
  return new Promise((resolve, reject) => {
    let started = false

    const run = (): Promise<never> => {
      if (!started) {
        started = true
        inner().then(resolve, reject)
      }

      return new Promise<never>(() => undefined)
    }

    new Promise((settle) => settle(call(run))).then(() => {
      if (!started) {
        reject(new Error(`${kind} did not call ${RUN_FUNCTIONS[kind]}()`))
      }
    }, reject)
  })
}

/** The around hooks nested around `inner`, the first one outermost, as in Vitest. */
function nested(kind: AroundKind, calls: AroundCall[], inner: Step): Step {
  return calls.reduceRight<Step>((next, call) => () => around(kind, call, next), inner)
}

/** The `aroundEach` hooks of every suite on the path, then the `beforeEach` hooks and the body. */
function testStep(arrange: Arrange): Step {
  const { match, context } = arrange

  const inner: Step = async () => {
    for (const suite of match.suites) {
      for (const hook of suite.hooks.beforeEach) {
        await withFixtures(arrange, { callback: hook, index: 0 }, () => hook(context))
      }
    }

    const { body, uses } = match.test

    if (body !== undefined) {
      await withFixtures(arrange, uses, () => body(context))
    }
  }

  const calls = match.suites.flatMap((suite) =>
    suite.hooks.aroundEach.map(
      (hook): AroundCall =>
        (run) =>
          withFixtures(arrange, { callback: hook, index: 1 }, () => hook(run, context, suite)),
    ),
  )

  return nested('aroundEach', calls, inner)
}

/** One suite on the path: its `aroundAll` hooks around its `beforeAll` hooks and everything below. */
function suiteStep(arrange: Arrange, depth: number): Step {
  const { match, context } = arrange
  const suite: LiveSuite | undefined = match.suites[depth]

  if (suite === undefined) {
    return testStep(arrange)
  }

  const inner: Step = async () => {
    for (const hook of suite.hooks.beforeAll) {
      await hook(context)
    }

    await suiteStep(arrange, depth + 1)()
  }

  const calls = suite.hooks.aroundAll.map(
    (hook): AroundCall =>
      (run) =>
        hook(run, context, suite),
  )

  return nested('aroundAll', calls, inner)
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
 * Runs a test's arrange phase the way Vitest runs a test: for each suite from
 * the root down, its `aroundAll` hooks around its `beforeAll` hooks, then the
 * `aroundEach` hooks of the path around the `beforeEach` hooks and the body,
 * each test-scope callback after the fixtures it uses. It stops when the
 * first render throws the stop signal, so no teardown runs. Unless the render
 * reported `mounted`, it reports why the page shows nothing.
 */
export async function runLiveTest(match: LiveTestMatch, testTimeout: number): Promise<void> {
  const timeout = timeoutOf(match, testTimeout)
  const controller = new AbortController()
  const context = liveTestContext(match, controller.signal)
  const arrange: Arrange = { match, context, computed: new Set() }
  const outcome = await withTimeout(suiteStep(arrange, 0)(), timeout, () => controller.abort())

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
