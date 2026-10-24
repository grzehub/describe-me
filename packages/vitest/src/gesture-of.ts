import type { GestureKind } from '@describe-me/core'

// Playwright's `wheel` hovers first, as a click does, so it ends a hover like
// one. Vitest's browser `type` only focuses its element, so it clicks nothing.
const GESTURES = new Map<string, GestureKind>([
  ['hover', 'hover'],
  ['unhover', 'unhover'],
  ['click', 'pointer'],
  ['dblClick', 'pointer'],
  ['tripleClick', 'pointer'],
  ['pointer', 'pointer'],
  ['wheel', 'pointer'],
  ['dropTo', 'pointer'],
  ['tab', 'keyboard'],
  ['keyboard', 'keyboard'],
  ['type', 'keyboard'],
])

/**
 * What a userEvent or locator method does to hover and focus, for
 * `recorder.noteGesture()`, or `undefined` when it changes neither.
 */
export function gestureOf(method: string): GestureKind | undefined {
  return GESTURES.get(method)
}
