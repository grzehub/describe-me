import type { FrameSide } from '../cli/changes-report.js'
import { changeMarks } from './change-marks.js'
import { liveShown } from './live-shown.js'
import { currentTest, state } from './state.js'
import { testShown } from './test-shown.js'

/** The sides of the frame on screen: the base's, and whether the current run has one. */
export interface FrameSides {
  before: FrameSide | null
  after: boolean
}

/**
 * What the Before / After switch offers for the frame on screen: both sides
 * of a changed frame, only After for an added one and only Before for a
 * removed one. `null` hides the switch: in Live, without a report or a mark
 * for the test, and on a frame the mark does not list.
 */
export function frameSides(): FrameSides | null {
  const test = currentTest()

  if (test === null || !testShown() || liveShown()) {
    return null
  }

  const mark = changeMarks(state.changes).get(test.id)

  if (mark === undefined) {
    return null
  }

  if (state.removedFrame !== null) {
    const removed = mark.removed.find((frame) => frame.base.index === state.removedFrame)

    return removed === undefined ? null : { before: removed.base, after: false }
  }

  const change = mark.frames.get(state.frame)

  if (change === undefined) {
    return null
  }

  if (change === 'added') {
    return { before: null, after: true }
  }

  return { before: mark.pairs.get(state.frame) ?? null, after: true }
}
