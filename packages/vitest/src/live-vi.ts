import { liveMock, type LiveImplementation } from './live-mock.js'
import { liveSpyOn } from './live-spy-on.js'

let vi: object | undefined

function isMockFunction(value: unknown): boolean {
  return (
    typeof value === 'function' && (value as { _isMockFunction?: unknown })._isMockFunction === true
  )
}

function createVi(): object {
  const known: Record<string, unknown> = {
    fn: (implementation?: LiveImplementation) => liveMock({ implementation }),
    spyOn: liveSpyOn,
    hoisted: (factory: () => unknown) => factory(),
    stubGlobal: (name: string, value: unknown) => {
      const scope = globalThis as Record<string, unknown>

      scope[name] = value

      return proxy
    },
    isMockFunction,
  }

  const proxy: object = new Proxy(known, {
    get(target, key) {
      if (typeof key !== 'string' || key === 'then') {
        return undefined
      }

      if (Object.hasOwn(target, key)) {
        return target[key]
      }

      return () => proxy
    },
  })

  return proxy
}

/**
 * `vi` and its alias `vitest` on the live page. Keys it does not know do
 * nothing and return `vi`, so fake timers and module mocks are skipped and
 * time is real. `await vi.waitFor(…)` ends, because `vi` has no `then`.
 */
export function liveVi(): object {
  vi ??= createVi()

  return vi
}
