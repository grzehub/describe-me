import { liveInert } from '@describe-me/core/live'
import { liveHook } from './live-hook.js'
import { liveRegistrar } from './live-registrar.js'
import { liveStep } from './live-step.js'
import { liveVi } from './live-vi.js'

/** The modules that the live page swaps for shims. */
type LiveModule = 'vitest' | 'vitest/browser' | '@describe-me/vitest'

type Shims = Record<LiveModule, Record<string, unknown>>

let shims: Shims | undefined

function ignore(): undefined {
  return undefined
}

function createShims(): Shims {
  const describe = liveRegistrar('suite')
  const it = liveRegistrar('test')
  const vi = liveVi()

  return {
    vitest: {
      describe,
      suite: describe,
      it,
      test: it,
      beforeAll: liveHook('beforeAll'),
      beforeEach: liveHook('beforeEach'),
      afterEach: liveHook('afterEach'),
      afterAll: liveHook('afterAll'),
      onTestFinished: ignore,
      onTestFailed: ignore,
      vi,
      vitest: vi,
      assertType: ignore,
      inject: ignore,
    },
    // The page never interacts, so all of `vitest/browser` is inert.
    'vitest/browser': {},
    '@describe-me/vitest': { step: liveStep },
  }
}

/**
 * The live page's implementation of one export of a module it swaps for a
 * shim. The plugin's generated modules call it once per name. A name the shim
 * does not implement, such as `expect` or one that a newer Vitest adds, gets an
 * inert value.
 */
export function liveExport(module: LiveModule, name: string): unknown {
  shims ??= createShims()

  const shim = shims[module]

  return Object.hasOwn(shim, name) ? shim[name] : liveInert()
}
