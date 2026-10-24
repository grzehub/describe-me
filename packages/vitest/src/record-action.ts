import { recorder } from '@describe-me/core'
import type { CaptureOptions, GestureKind } from '@describe-me/core'

/** What one interaction did to hover and focus. `target` is the element a hover rests on. */
export interface ActionGesture {
  kind: GestureKind
  target?: Element
}

/** How `recordAction()` takes its frame, and the gesture it notes first. */
export interface RecordActionOptions extends Pick<CaptureOptions, 'settle'> {
  gesture?: ActionGesture
}

/**
 * Nesting depth of the interactions in flight, and the test they started in.
 * `userEvent.click(el)` delegates to `locator.click()`, and `copy()` delegates
 * to `keyboard()`, so without this guard one gesture would produce two
 * frames. Keyed to the recorder's generation, so an interaction that an ended
 * test left running cannot swallow the next test's frame.
 */
const nesting = { generation: -1, depth: 0 }

/**
 * Run one user interaction and record a frame for it, but only for the outermost call.
 * `settle: false` takes the frame as soon as the interaction resolves, without a wait.
 * The gesture is noted for nested calls too, so the outermost one is noted last.
 */
export async function recordAction<T>(
  label: string,
  run: () => Promise<T>,
  options: RecordActionOptions = {},
): Promise<T> {
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

  const { gesture } = options

  // Noted once the gesture is done, so the render frame that
  // `beforeInteraction()` took never shows it, and one that threw changes
  // nothing. A gesture that outlived its test is dropped.
  if (gesture !== undefined && generation === recorder.generation) {
    recorder.noteGesture(gesture.kind, gesture.target)
  }

  if (generation === nesting.generation && nesting.depth === 0) {
    await recorder.capture('action', label, undefined, { generation, settle: options.settle })
  }

  return result
}
