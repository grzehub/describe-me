import type { LiveFixtureUse } from './live-fixture-props.js'
import type { LiveFixtures } from './live-fixture-registrations.js'

/** When a hook runs, relative to the tests of its suite. */
export type LiveHookKind =
  'beforeAll' | 'beforeEach' | 'afterEach' | 'afterAll' | 'aroundEach' | 'aroundAll'

/** A hook, a test body or a suite factory, as the test file wrote it. */
export type LiveCallback = (...args: unknown[]) => unknown

/** A test as the live page registers it. `it.todo` registers one without a body. */
export interface LiveTest {
  kind: 'test'
  name: string
  body?: LiveCallback
  timeout?: number
  /** The `test.extend` fixtures of the chain that registered it. */
  fixtures: LiveFixtures
  /** Where the body names the fixtures it uses, or null when it gets no context, as an `each` row. */
  uses: LiveFixtureUse | null
}

/** A suite as the live page registers it, with its factory until the runner collects it. */
export interface LiveSuite {
  kind: 'suite'
  name: string
  factory?: LiveCallback
  timeout?: number
  children: (LiveSuite | LiveTest)[]
  hooks: Record<LiveHookKind, LiveCallback[]>
}

/** A suite with nothing registered on it yet. */
export function liveSuite(name: string, factory?: LiveCallback, timeout?: number): LiveSuite {
  return {
    kind: 'suite',
    name,
    factory,
    timeout,
    children: [],
    hooks: {
      beforeAll: [],
      beforeEach: [],
      afterEach: [],
      afterAll: [],
      aroundEach: [],
      aroundAll: [],
    },
  }
}
