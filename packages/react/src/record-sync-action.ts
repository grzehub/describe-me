import { recorder } from '@describe-me/core'
import type { GestureKind } from '@describe-me/core'

/** What one event did to hover. `target` is the element a hover rests on. */
export interface SyncGesture {
  kind: GestureKind
  target?: Element
}

/**
 * Nesting depth of synchronous interactions currently running. A handler
 * that fires another event from inside the first would otherwise record two
 * frames for one call.
 */
let depth = 0

/**
 * Run one synchronous interaction and record a frame for it, but only for the
 * outermost call and only when it returns. Testing Library wraps every event
 * in `act()`, so the DOM is committed by then and the frame is taken without
 * settling. `gesture` is noted for nested calls too, so the outermost one is
 * noted last.
 */
export function recordSyncAction<T>(label: string, run: () => T, gesture?: SyncGesture): T {
  recorder.beforeInteraction()
  depth++

  let result: T

  try {
    result = run()
  } finally {
    depth--
  }

  // Noted once the event is done, so the render frame that
  // `beforeInteraction()` took never shows it, and one that threw changes nothing.
  if (gesture !== undefined) {
    recorder.noteGesture(gesture.kind, gesture.target)
  }

  if (depth === 0) {
    void recorder.capture('action', label, undefined, { settle: false })
  }

  return result
}
