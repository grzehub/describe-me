import { liveInert } from '@describe-me/core/live'
import { liveEachName } from './live-each-name.js'
import type { LiveFixtureUse } from './live-fixture-props.js'
import { liveFixtureRegistrations, type LiveFixtures } from './live-fixture-registrations.js'
import { liveHook } from './live-hook.js'
import { liveRegistry } from './live-registry.js'
import { liveSuite, type LiveCallback, type LiveHookKind } from './live-suite.js'

type LiveKind = 'suite' | 'test'

/** One chain of modifiers. `todo` drops the body, as `it.todo` has none. */
interface Chain {
  kind: LiveKind
  todo: boolean
  /** The `test.extend` fixtures, which every test registered through the chain keeps. */
  fixtures: LiveFixtures
}

/** Modifiers that change how Vitest runs a suite or a test, not whether it is registered. */
const RUN_MODIFIERS: Record<LiveKind, Set<string>> = {
  suite: new Set(['skip', 'only', 'concurrent', 'sequential', 'shuffle']),
  test: new Set(['skip', 'only', 'concurrent', 'sequential', 'fails']),
}

/** The hooks that Vitest's `test` carries as members, so `test.beforeEach(…)` works. */
const HOOKS = new Set<string>([
  'beforeAll',
  'beforeEach',
  'afterEach',
  'afterAll',
  'aroundEach',
  'aroundAll',
])

const NO_FIXTURES: LiveFixtures = new Map()

function nameOf(name: unknown): string {
  if (typeof name === 'string') {
    return name
  }

  if (typeof name === 'function') {
    return name.name || '<anonymous>'
  }

  return String(name)
}

function timeoutOf(options: unknown): number | undefined {
  if (typeof options === 'number') {
    return options
  }

  if (typeof options !== 'object' || options === null) {
    return undefined
  }

  const { timeout } = options as { timeout?: unknown }

  return typeof timeout === 'number' ? timeout : undefined
}

/** The body and timeout of `(name, fn)`, `(name, options, fn)` or `(name, fn, options | timeout)`. */
function bodyAndTimeout(
  second: unknown,
  third: unknown,
): { body?: LiveCallback; timeout?: number } {
  if (typeof second === 'function') {
    return { body: second as LiveCallback, timeout: timeoutOf(third) }
  }

  return {
    body: typeof third === 'function' ? (third as LiveCallback) : undefined,
    timeout: timeoutOf(second),
  }
}

function add(
  chain: Chain,
  name: string,
  body: LiveCallback | undefined,
  timeout: number | undefined,
  uses: LiveFixtureUse | null,
): void {
  const suite = liveRegistry().current
  const kept = chain.todo ? undefined : body

  if (chain.kind === 'suite') {
    suite.children.push(liveSuite(name, kept, timeout))

    return
  }

  suite.children.push({ kind: 'test', name, body: kept, timeout, fixtures: chain.fixtures, uses })
}

/** Like Vitest's `toArray`: no value is no item. */
function toArray(row: unknown): unknown[] {
  if (row === undefined || row === null) {
    return []
  }

  return Array.isArray(row) ? row : [row]
}

function rowName(name: unknown, items: unknown[], index: number): string {
  return liveEachName(nameOf(name), items, index, liveRegistry().vitestMajor)
}

/** The rows of a table, or of a tagged template such as `it.each\`a | b\``, as Vitest reads them. */
function rowsOf(table: unknown, values: unknown[]): unknown[] {
  if (!Array.isArray(table)) {
    return []
  }

  if (values.length === 0) {
    return table
  }

  const header = table.join('').trim().replace(/ /g, '').split('\n')[0].split('|')
  const rows: unknown[] = []

  for (let i = 0; i + header.length <= values.length; i += header.length) {
    rows.push(Object.fromEntries(header.map((key, j) => [key, values[i + j]])))
  }

  return rows
}

/**
 * `each(table)`: one suite or test per row. Like Vitest, it spreads rows when
 * every row is an array, and the body gets no context.
 */
function each(chain: Chain) {
  return (table: unknown, ...values: unknown[]) =>
    (name: unknown, second?: unknown, third?: unknown): void => {
      const rows = rowsOf(table, values)
      const spread = rows.every((row) => Array.isArray(row))
      const { body, timeout } = bodyAndTimeout(second, third)

      rows.forEach((row, index) => {
        const items = Array.isArray(row) ? row : [row]
        const args = spread ? items : [row]
        const rowBody = body === undefined ? undefined : () => body(...args)

        add(chain, rowName(name, items, index), rowBody, timeout, null)
      })
    }
}

/**
 * `for(table)`: one suite or test per row, whose body gets the row and the
 * test context. The body names its fixtures in its second parameter.
 */
function forEachRow(chain: Chain) {
  return (table: unknown, ...values: unknown[]) =>
    (name: unknown, second?: unknown, third?: unknown): void => {
      const { body, timeout } = bodyAndTimeout(second, third)
      const uses = body === undefined ? null : { callback: body, index: 1 }

      rowsOf(table, values).forEach((row, index) => {
        const rowBody = body === undefined ? undefined : (context: unknown) => body(row, context)

        add(chain, rowName(name, toArray(row), index), rowBody, timeout, uses)
      })
    }
}

/** What Vitest's `test` carries besides modifiers: `extend`, `describe`, `suite` and the hooks. */
function testMember(chain: Chain, key: string): unknown {
  if (key === 'extend') {
    return (...args: unknown[]) =>
      chained({
        kind: 'test',
        todo: false,
        fixtures: liveFixtureRegistrations(chain.fixtures, args),
      })
  }

  if (key === 'describe' || key === 'suite') {
    return liveRegistrar('suite')
  }

  if (HOOKS.has(key)) {
    return liveHook(key as LiveHookKind)
  }

  return undefined
}

function member(chain: Chain, key: string | symbol, self: unknown): unknown {
  if (typeof key === 'string' && RUN_MODIFIERS[chain.kind].has(key)) {
    return self
  }

  if (key === 'skipIf' || key === 'runIf') {
    return () => self
  }

  if (key === 'todo') {
    return chained({ ...chain, todo: true })
  }

  if (key === 'each') {
    return each(chain)
  }

  if (key === 'for') {
    return forEachRow(chain)
  }

  const own = chain.kind === 'test' && typeof key === 'string' ? testMember(chain, key) : undefined

  return own ?? Reflect.get(liveInert() as object, key)
}

function chained(chain: Chain): unknown {
  const register = (name: unknown, second?: unknown, third?: unknown): void => {
    const { body, timeout } = bodyAndTimeout(second, third)
    const uses = body === undefined ? null : { callback: body, index: 0 }

    add(chain, nameOf(name), body, timeout, uses)
  }

  const self: unknown = new Proxy(register, {
    get(_target, key) {
      return member(chain, key, self)
    },
  })

  return self
}

/**
 * `describe`, `suite`, `it` or `test` on the live page. A call registers
 * whatever modifiers come before it, because a skipped test keeps its entry
 * in the manifest. `test.extend(…)` returns a chain whose tests keep the
 * merged fixtures. Properties the page does not know, such as `override`,
 * are inert.
 */
export function liveRegistrar(kind: LiveKind): unknown {
  return chained({ kind, todo: false, fixtures: NO_FIXTURES })
}
