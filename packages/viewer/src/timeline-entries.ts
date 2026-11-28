import type { ManifestTest } from '@describe-me/core/types'
import type { RemovedFrame } from './change-marks.js'
import { changeMarks } from './change-marks.js'
import { state } from './state.js'

/** A button of the frame timeline: a frame of the current run, or one that only the base has. */
export type TimelineEntry = { frame: number } | { removed: RemovedFrame }

/**
 * The frame timeline of a test: its frames in order, each removed frame of its
 * mark right after the frame it follows, or first. A removed frame placed past
 * the test's last frame follows the last one. Without a report or a mark, only
 * the test's frames.
 */
export function timelineEntries(test: ManifestTest): TimelineEntry[] {
  const removed = changeMarks(state.changes).get(test.id)?.removed ?? []
  const last = test.frames.length - 1
  const placedAfter = (frame: RemovedFrame): number => Math.min(frame.after, last)
  const entries: TimelineEntry[] = removed
    .filter((frame) => placedAfter(frame) < 0)
    .map((frame) => ({ removed: frame }))

  for (let index = 0; index <= last; index++) {
    entries.push({ frame: index })

    for (const frame of removed) {
      if (placedAfter(frame) === index) {
        entries.push({ removed: frame })
      }
    }
  }

  return entries
}
