import { liveState } from './live-state.js'
import type { LiveStatus } from './types.js'

/** The status the live page reported so far, or null before the first one. */
export function liveStatus(): LiveStatus | null {
  return liveState().status
}
