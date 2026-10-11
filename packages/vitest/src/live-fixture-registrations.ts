import type { LiveCallback } from './live-suite.js'

/** One fixture of `test.extend`, as the live page registers it. */
export interface LiveFixture {
  name: string
  /** The value, or the function `({ deps }, use) => …` that computes it. */
  value: unknown
  auto: boolean
  /** The function whose first parameter names the dependencies: the builder function for the builder syntax. */
  source?: LiveCallback
  /** The definition this one redefines, which a fixture that depends on its own name gets. */
  parent?: LiveFixture
}

/** The fixtures of one chain, by name. */
export type LiveFixtures = ReadonlyMap<string, LiveFixture>

const OPTION_KEYS = ['auto', 'injected', 'scope']

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFixtureOptions(value: unknown): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).some((key) => OPTION_KEYS.includes(key))
}

function ignore(): undefined {
  return undefined
}

/** A builder function `(context, { onCleanup }) => value` as a fixture function. Cleanups never run. */
function builderFixture(builder: LiveCallback): LiveCallback {
  return async (context, use) => {
    await (use as LiveCallback)(await builder(context, { onCleanup: ignore }))
  }
}

/** The arguments of `extend`, in the object syntax, as Vitest's `parseBuilderFixtures` reads them. */
function definitionsOf(args: unknown[]): {
  definitions: Record<string, unknown>
  source?: LiveCallback
} {
  const [first, second, third] = args

  if (typeof first !== 'string') {
    return { definitions: isObject(first) ? first : {} }
  }

  let options: unknown
  let value: unknown

  if (third !== undefined) {
    options = second
    value = third
  } else if (isFixtureOptions(second)) {
    options = second
    value = {}
  } else {
    value = second
  }

  const builder = typeof value === 'function' ? (value as LiveCallback) : undefined
  const fixture = builder === undefined ? value : builderFixture(builder)

  return { definitions: { [first]: options ? [fixture, options] : fixture }, source: builder }
}

function register(
  registrations: Map<string, LiveFixture>,
  name: string,
  definition: unknown,
  source: LiveCallback | undefined,
): void {
  const hasOptions =
    Array.isArray(definition) && definition.length >= 2 && isFixtureOptions(definition[1])

  const value: unknown = hasOptions ? (definition as unknown[])[0] : definition
  const parent = registrations.get(name)
  let auto = parent?.auto ?? false

  if (hasOptions) {
    auto = Boolean((definition as Record<string, unknown>[])[1].auto)
  }

  registrations.set(name, {
    name,
    value,
    auto,
    source: source ?? (typeof value === 'function' ? (value as LiveCallback) : undefined),
    parent,
  })
}

/**
 * The fixtures of a chain after `extend(…)`, in the object syntax of Vitest
 * 4.1 and 5 or their builder syntax `extend(name, options?, value)`. A
 * redefined fixture keeps the earlier one as its parent. An `injected`
 * fixture keeps its default value, and every scope counts as the test's.
 */
export function liveFixtureRegistrations(fixtures: LiveFixtures, args: unknown[]): LiveFixtures {
  const registrations = new Map(fixtures)
  const { definitions, source } = definitionsOf(args)

  for (const [name, definition] of Object.entries(definitions)) {
    register(registrations, name, definition, source)
  }

  return registrations
}
