import { currentTest, state } from './state.js'
import { testShown } from './test-shown.js'

/**
 * Whether the stage shows the selected test live: Live is on, the preview is
 * ready, neither an overview nor Foundations is open and a test is selected.
 * Until the preview is ready, a link with `live=1` shows the recorded frame.
 */
export function liveShown(): boolean {
  return state.live && state.preview.status === 'ready' && testShown() && currentTest() !== null
}
