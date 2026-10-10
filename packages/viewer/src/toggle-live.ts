import { rerender } from './rerender.js'
import { currentTest, state, writeHash } from './state.js'

/**
 * Turn Live on or off for the selected test. Does nothing unless the preview
 * is ready, a test is selected and no overview is open.
 */
export function toggleLive(): void {
  if (state.preview.status !== 'ready' || !currentTest() || state.suiteKey) {
    return
  }

  state.live = !state.live
  writeHash('replace')
  rerender('frame')
}
