import { recorder } from '@describe-me/core'

/**
 * Nesting depth of interactions currently in flight. `userEvent.click(el)`
 * delegates to `locator.click()`, and `copy()` delegates to `keyboard()`, so
 * without this guard one gesture would produce two frames.
 */
let depth = 0

/** Run one user interaction and record a frame for it, but only for the outermost call. */
export async function recordAction<T>(label: string, run: () => Promise<T>): Promise<T> {
  depth++

  let result: T

  try {
    result = await run()
  } finally {
    depth--
  }

  if (depth === 0) {
    await recorder.capture('action', label)
  }

  return result
}
