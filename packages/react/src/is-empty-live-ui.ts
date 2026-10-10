import { Fragment, isValidElement } from 'react'

/**
 * Whether a test rendered nothing yet: `null`, `undefined`, a boolean, `''`,
 * or a fragment whose children are all empty. The live render then waits for
 * the test's `rerender`.
 */
export function isEmptyLiveUi(ui: unknown): boolean {
  if (ui === null || ui === undefined || typeof ui === 'boolean' || ui === '') {
    return true
  }

  if (Array.isArray(ui)) {
    return ui.every((child) => isEmptyLiveUi(child))
  }

  if (!isValidElement(ui) || ui.type !== Fragment) {
    return false
  }

  return isEmptyLiveUi((ui.props as { children?: unknown }).children)
}
