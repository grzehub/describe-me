import { liveFixtureProps, type LiveFixtureUse } from './live-fixture-props.js'
import type { LiveFixture, LiveFixtures } from './live-fixture-registrations.js'
import type { LiveCallback } from './live-suite.js'

/** Names of the test context that are never fixtures. */
const BUILT_IN = new Set([
  'task',
  'expect',
  'skip',
  'signal',
  'onTestFinished',
  'onTestFailed',
  'annotate',
])

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The error with the fixture's name in front, and the stack of the original. */
function namedError(name: string, error: unknown): Error {
  const named = new Error(`fixture "${name}": ${messageOf(error)}`)

  if (error instanceof Error && typeof error.stack === 'string') {
    const heading = String(error)
    const frames = error.stack.startsWith(heading)
      ? error.stack.slice(heading.length)
      : `\n${error.stack}`

    named.stack = `${String(named)}${frames}`
  }

  return named
}

/** The fixtures a fixture function depends on. Its own name means the definition it redefines. */
function dependenciesOf(fixture: LiveFixture, fixtures: LiveFixtures): LiveFixture[] {
  let names: Set<string>

  try {
    names =
      fixture.source === undefined
        ? new Set()
        : liveFixtureProps({ callback: fixture.source, index: 0 })
  } catch (error) {
    throw namedError(fixture.name, error)
  }

  const dependencies: LiveFixture[] = []

  for (const name of names) {
    const dependency = name === fixture.name ? fixture.parent : fixtures.get(name)

    if (dependency !== undefined) {
      dependencies.push(dependency)
    } else if (name === fixture.name) {
      throw new Error(`fixture "${name}" depends on itself but redefines no fixture`)
    } else if (!BUILT_IN.has(name)) {
      throw new Error(`fixture "${fixture.name}" depends on unknown fixture "${name}"`)
    }
  }

  return dependencies
}

/** The fixtures to compute in order, dependencies first, as Vitest's `resolveDeps` orders them. */
function pendingOf(
  used: LiveFixture[],
  fixtures: LiveFixtures,
  path: Set<LiveFixture> = new Set(),
  pending: LiveFixture[] = [],
): LiveFixture[] {
  for (const usedFixture of used) {
    let fixture = usedFixture

    if (pending.includes(fixture)) {
      continue
    }

    if (typeof fixture.value !== 'function') {
      pending.push(fixture)
      continue
    }

    if (path.has(fixture)) {
      if (fixture.parent === undefined) {
        const cycle = [...path].reverse().map((step) => step.name)

        throw new Error(
          `fixture "${fixture.name}" is part of a cycle: ${[fixture.name, ...cycle].join(' <- ')}`,
        )
      }

      fixture = fixture.parent
    }

    path.add(fixture)
    pendingOf(dependenciesOf(fixture, fixtures), fixtures, path, pending)
    pending.push(fixture)
    path.clear()
  }

  return pending
}

/**
 * One fixture's value. A fixture function gets a `use` that keeps the value
 * and never settles, so the teardown after `await use(value)` never runs.
 */
function valueOf(fixture: LiveFixture, context: object): unknown {
  if (typeof fixture.value !== 'function') {
    return fixture.value
  }

  const compute = fixture.value as LiveCallback

  return new Promise((resolve, reject) => {
    let used = false

    const use = (value: unknown): Promise<never> => {
      used = true
      resolve(value)

      return new Promise<never>(() => undefined)
    }

    new Promise((settle) => settle(compute(context, use))).then(
      () => {
        if (!used) {
          reject(new Error(`fixture "${fixture.name}" settled without calling use()`))
        }
      },
      (error: unknown) => {
        if (!used) {
          reject(namedError(fixture.name, error))
        }
      },
    )
  })
}

/**
 * Computes the fixtures that one test-scope callback uses before it runs:
 * those its parameter destructures and every `auto` fixture, dependencies
 * first. Each fixture runs once per page, and its value becomes a property of
 * the context. A fixture that fails throws an error that names it.
 */
export async function liveFixtureValues(
  fixtures: LiveFixtures,
  use: LiveFixtureUse | null,
  context: Record<string, unknown>,
  computed: Set<LiveFixture>,
): Promise<void> {
  if (fixtures.size === 0) {
    return
  }

  const props = use === null ? new Set<string>() : liveFixtureProps(use)
  const used = [...fixtures.values()].filter(
    (fixture) => !BUILT_IN.has(fixture.name) && (fixture.auto || props.has(fixture.name)),
  )

  for (const fixture of pendingOf(used, fixtures)) {
    if (computed.has(fixture)) {
      continue
    }

    computed.add(fixture)
    context[fixture.name] = await valueOf(fixture, context)
  }
}
