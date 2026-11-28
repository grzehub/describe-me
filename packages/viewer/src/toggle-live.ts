import { rerender } from './rerender.js'
import { currentTest, state, writeHash } from './state.js'
import { testShown } from './test-shown.js'

/**
 * Turn Live on or off for the selected test. Does nothing unless the preview
 * is ready, a test is selected and neither an overview nor Foundations is open.
 * Live has no Before and no removed frame, so turning it off shows After.
 */
export function toggleLive(): void {
  if (state.preview.status !== 'ready' || !currentTest() || !testShown()) {
    return
  }

  state.live = !state.live

  if (state.live) {
    state.before = false
    state.removedFrame = null
  }

  writeHash('replace')
  rerender('frame')
}
