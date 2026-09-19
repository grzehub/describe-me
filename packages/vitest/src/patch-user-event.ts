import { userEvent } from 'vitest/browser'
import { actionLabel } from './action-label.js'
import { recordAction } from './record-action.js'

/**
 * `userEvent` methods that do not go through a locator. The element-based ones
 * (`click`, `fill`, ...) delegate to `Locator` and are covered by `patchLocators`.
 */
const KEYBOARD_METHODS = ['type', 'tab', 'keyboard', 'copy', 'cut', 'paste'] as const

const PATCHED = Symbol.for('describe-me.patched')

type UserEventMethod = (...args: unknown[]) => Promise<unknown>

/** Wrap the keyboard-level `userEvent` methods in place so each call records a frame. Safe to call more than once. */
export function patchUserEvent(): void {
  const target = userEvent as unknown as Record<string, UserEventMethod & { [PATCHED]?: true }>

  for (const method of KEYBOARD_METHODS) {
    const original = target[method]

    if (typeof original !== 'function' || original[PATCHED]) {
      continue
    }

    const wrapped: UserEventMethod & { [PATCHED]?: true } = (...args) => {
      const label = actionLabel(method, undefined, args)

      return recordAction(label, () => original.apply(userEvent, args))
    }

    wrapped[PATCHED] = true
    target[method] = wrapped
  }
}
