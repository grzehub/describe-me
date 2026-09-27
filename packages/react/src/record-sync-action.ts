import { recorder } from '@describe-me/core'

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
 * settling.
 */
export function recordSyncAction<T>(label: string, run: () => T): T {
  depth++

  let result: T

  try {
    result = run()
  } finally {
    depth--
  }

  if (depth === 0) {
    void recorder.capture('action', label, undefined, { settle: false })
  }

  return result
}
