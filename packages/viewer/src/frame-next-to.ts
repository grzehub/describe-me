import type { ManifestTest } from '@describe-me/core/types'
import type { RemovedFrame } from './change-marks.js'

/**
 * The frame of the current run that a removed frame follows in the timeline,
 * or the first frame for one at the start. It stays selected while the removed
 * frame shows, so leaving it lands next to it.
 */
export function frameNextTo(test: ManifestTest, removed: RemovedFrame): number {
  return Math.max(0, Math.min(removed.after, test.frames.length - 1))
}
