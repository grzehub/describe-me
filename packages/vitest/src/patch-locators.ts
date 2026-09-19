import { page } from 'vitest/browser'
import { actionLabel } from './action-label.js'
import { recordAction } from './record-action.js'

/** Locator methods that act on the page. Query methods (`getByRole`, `nth`, ...) are left alone. */
const ACTION_METHODS = [
  'click',
  'dblClick',
  'tripleClick',
  'wheel',
  'clear',
  'hover',
  'unhover',
  'fill',
  'dropTo',
  'selectOptions',
  'upload',
] as const

const PATCHED = Symbol.for('describe-me.patched')

type ActionMethod = (this: LocatorLike, ...args: unknown[]) => Promise<unknown>

interface LocatorLike {
  selector?: string
}

/** Walk the prototype chain and return the first object that defines `name` itself. */
function findOwner(start: object, name: string): Record<string, unknown> | null {
  let current: object | null = start

  while (current && current !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(current, name)) {
      return current as Record<string, unknown>
    }

    current = Object.getPrototypeOf(current)
  }

  return null
}

/**
 * Wrap every action method of Vitest's `Locator` so that
 * `screen.getByRole('button').click()` records a frame, exactly like
 * `userEvent.click()` does. Safe to call more than once.
 */
export function patchLocators(): void {
  const sample = page.elementLocator(document.body) as unknown as object
  const prototype = Object.getPrototypeOf(sample) as object

  for (const method of ACTION_METHODS) {
    const owner = findOwner(prototype, method)

    if (!owner || typeof owner[method] !== 'function') {
      continue
    }

    const original = owner[method] as ActionMethod & { [PATCHED]?: true }

    if (original[PATCHED]) {
      continue
    }

    const wrapped: ActionMethod & { [PATCHED]?: true } = function (this: LocatorLike, ...args) {
      const label = actionLabel(method, this.selector, args)

      return recordAction(label, () => original.apply(this, args))
    }

    wrapped[PATCHED] = true
    owner[method] = wrapped
  }
}
