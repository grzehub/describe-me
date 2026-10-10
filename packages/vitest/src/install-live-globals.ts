import { liveExport } from './live-export.js'

/** The names Vitest puts on `globalThis` with `test.globals`. */
const GLOBALS = [
  'suite',
  'test',
  'describe',
  'it',
  'chai',
  'expect',
  'assert',
  'expectTypeOf',
  'assertType',
  'vitest',
  'vi',
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
  'onTestFinished',
  'onTestFailed',
  'aroundEach',
  'aroundAll',
]

/**
 * Puts the shimmed globals on `globalThis`, as `test.globals` does. It runs
 * before the test file imports, so Testing Library finds the hooks too.
 */
export function installLiveGlobals(): void {
  const scope = globalThis as Record<string, unknown>

  for (const name of GLOBALS) {
    scope[name] = liveExport('vitest', name)
  }
}
