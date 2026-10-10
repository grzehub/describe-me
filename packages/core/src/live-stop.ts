import { liveState } from './live-state.js'

/**
 * The page's one stop signal. The live render throws it to end the test at
 * its first render, and the runner tells it apart from a failure.
 */
export function liveStop(): Error {
  return liveState().stop
}
