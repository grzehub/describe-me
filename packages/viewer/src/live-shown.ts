import { currentTest, state } from './state.js'

/**
 * Whether the stage shows the selected test live: Live is on, the preview is
 * ready, no overview is open and a test is selected. Until the preview is
 * ready, a link with `live=1` shows the recorded frame.
 */
export function liveShown(): boolean {
  return state.live && state.preview.status === 'ready' && !state.suiteKey && currentTest() !== null
}
