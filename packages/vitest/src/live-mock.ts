import { postLiveMessage } from '@describe-me/core/live'
import { liveArgLabel } from './live-arg-label.js'

/** What a mock runs when it is called. */
export type LiveImplementation = (...args: unknown[]) => unknown

/** How `vi.fn()` and `vi.spyOn()` set up a mock. */
export interface LiveMockOptions {
  implementation?: LiveImplementation
  /** Default: `vi.fn()`, the name Vitest gives an unnamed mock. */
  name?: string
  /** Puts back what `vi.spyOn()` replaced. */
  restore?: () => void
}

/** A mock as tests see it: callable, with Vitest's `mock*` methods. */
export type LiveMock = LiveImplementation & Record<string, unknown>

interface MockResult {
  type: 'return' | 'throw'
  value: unknown
}

interface MockState {
  name: string
  implementation?: LiveImplementation
  once: LiveImplementation[]
  calls: unknown[][]
  results: MockResult[]
}

function recordResult(state: MockState, run: () => unknown): unknown {
  try {
    const value = run()

    state.results.push({ type: 'return', value })

    return value
  } catch (error) {
    state.results.push({ type: 'throw', value: error })

    throw error
  }
}

/** The `mock*` methods. Those that change the mock return it, as in Vitest. */
function mockMethods(
  state: MockState,
  options: LiveMockOptions,
  self: () => LiveMock,
): Record<string, unknown> {
  const clear = (): void => {
    state.calls.length = 0
    state.results.length = 0
  }

  const reset = (): void => {
    clear()
    state.implementation = options.implementation
    state.once.length = 0
  }

  const implement = (next: LiveImplementation): LiveMock => {
    state.implementation = next

    return self()
  }

  const implementOnce = (next: LiveImplementation): LiveMock => {
    state.once.push(next)

    return self()
  }

  return {
    mockImplementation: implement,
    mockImplementationOnce: implementOnce,
    mockReturnValue: (value: unknown) => implement(() => value),
    mockReturnValueOnce: (value: unknown) => implementOnce(() => value),
    mockResolvedValue: (value: unknown) => implement(() => Promise.resolve(value)),
    mockResolvedValueOnce: (value: unknown) => implementOnce(() => Promise.resolve(value)),
    mockRejectedValue: (error: unknown) => implement(() => Promise.reject(error)),
    mockRejectedValueOnce: (error: unknown) => implementOnce(() => Promise.reject(error)),
    mockName: (name: unknown) => {
      state.name = String(name)

      return self()
    },
    getMockName: () => state.name,
    mockClear: () => {
      clear()

      return self()
    },
    mockReset: () => {
      reset()

      return self()
    },
    mockRestore: () => {
      reset()
      options.restore?.()

      return self()
    },
  }
}

/**
 * Enough of Vitest's mock for an arrange phase. Every call posts an action to
 * the viewer under the mock's current name, so a click in the live component
 * shows as `onSelect("Rename")`.
 */
export function liveMock(options: LiveMockOptions = {}): LiveMock {
  const state: MockState = {
    name: options.name ?? 'vi.fn()',
    implementation: options.implementation,
    once: [],
    calls: [],
    results: [],
  }

  function mock(this: unknown, ...args: unknown[]): unknown {
    state.calls.push(args)
    postLiveMessage({ type: 'action', name: state.name, args: args.map(liveArgLabel) })

    const next = state.once.shift() ?? state.implementation
    const constructing = new.target !== undefined

    if (next === undefined) {
      return recordResult(state, () => undefined)
    }

    return recordResult(state, () =>
      constructing ? Reflect.construct(next, args) : next.apply(this, args),
    )
  }

  Object.assign(
    mock,
    mockMethods(state, options, () => proxy),
    {
      _isMockFunction: true,
      mock: {
        calls: state.calls,
        results: state.results,
        get lastCall() {
          return state.calls.at(-1)
        },
      },
    },
  )

  // Vitest keeps adding `mock*` methods. Unknown ones return the mock, so a chain still runs.
  const proxy = new Proxy(mock as LiveMock, {
    get(target, key, receiver) {
      if (typeof key === 'string' && key.startsWith('mock') && !(key in target)) {
        return () => proxy
      }

      return Reflect.get(target, key, receiver)
    },
  })

  return proxy
}
