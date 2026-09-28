import { recorder } from '@describe-me/core'

/**
 * Nesting depth of the interactions in flight, and the test they started in.
 * `userEvent.click(el)` delegates to `locator.click()`, and `copy()` delegates
 * to `keyboard()`, so without this guard one gesture would produce two
 * frames. Keyed to the recorder's generation, so an interaction that an ended
 * test left running cannot swallow the next test's frame.
 */
const nesting = { generation: -1, depth: 0 }

/** Run one user interaction and record a frame for it, but only for the outermost call. */
export async function recordAction<T>(label: string, run: () => Promise<T>): Promise<T> {
  const generation = recorder.generation

  if (generation !== nesting.generation) {
    nesting.generation = generation
    nesting.depth = 0
  }

  recorder.beforeInteraction()
  nesting.depth++

  let result: T

  try {
    result = await run()
  } finally {
    if (generation === nesting.generation) {
      nesting.depth--
    }
  }

  if (generation === nesting.generation && nesting.depth === 0) {
    await recorder.capture('action', label, undefined, { generation })
  }

  return result
}
