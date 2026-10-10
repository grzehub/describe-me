import { liveState } from './live-state.js'

/** Whether a thrown value is the live page's stop signal rather than a failure. */
export function isLiveStop(value: unknown): boolean {
  return value === liveState().stop
}
