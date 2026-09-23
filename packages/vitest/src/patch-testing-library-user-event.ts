import userEvent from '@testing-library/user-event'
import { describeArg } from './describe-arg.js'
import { elementLabel } from './element-label.js'
import { recordAction } from './record-action.js'

/** Every interaction of user-event 14 that can change what the page shows. */
const METHODS = [
  'click',
  'dblClick',
  'tripleClick',
  'hover',
  'unhover',
  'type',
  'clear',
  'keyboard',
  'tab',
  'paste',
  'copy',
  'cut',
  'pointer',
  'selectOptions',
  'deselectOptions',
  'upload',
] as const

const PATCHED = Symbol.for('describe-me.patched')

type Method = ((...args: unknown[]) => unknown) & { [PATCHED]?: true }
type Patchable = Record<string, Method | undefined>

function labelFor(method: string, args: unknown[]): string {
  const parts = args.map((arg) => elementLabel(arg) ?? describeArg(arg)).filter(Boolean)

  return `${method}(${parts.join(', ')})`
}

function patchMethods(target: Patchable): void {
  for (const method of METHODS) {
    const original = target[method]

    if (typeof original !== 'function' || original[PATCHED]) {
      continue
    }

    const wrapped: Method = (...args) =>
      recordAction(labelFor(method, args), async () => original.apply(target, args))

    wrapped[PATCHED] = true
    target[method] = wrapped
  }
}

/**
 * Wrap Testing Library's userEvent in place so each call records a frame.
 * It comes in two shapes, the direct API (`userEvent.click(el)`) and an
 * instance from `userEvent.setup()`, and the first delegates to the second,
 * so both are patched and `recordAction`'s depth guard keeps one gesture to
 * one frame. Safe to call more than once.
 */
export function patchTestingLibraryUserEvent(): void {
  const direct = userEvent as unknown as Patchable

  patchMethods(direct)

  const originalSetup = direct.setup

  if (typeof originalSetup !== 'function' || originalSetup[PATCHED]) {
    return
  }

  const wrappedSetup: Method = (...args) => {
    const instance = originalSetup.apply(direct, args) as Patchable

    patchMethods(instance)

    return instance
  }

  wrappedSetup[PATCHED] = true
  direct.setup = wrappedSetup
}
