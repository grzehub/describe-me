import type { ChangeMark } from './change-marks.js'
import { changeMarks } from './change-marks.js'
import { frameNextTo } from './frame-next-to.js'
import { allTests, select, state } from './state.js'

/** The removed frame a mark's changes start with, as `select()` takes it, or `null`. */
function firstRemovedOf(
  testId: string,
  mark: ChangeMark,
): { frame: number; removed: number } | null {
  const removed = mark.firstRemoved === null ? undefined : mark.removed[0]
  const test = state.manifest
    ? allTests(state.manifest).find((candidate) => candidate.id === testId)
    : undefined

  if (removed === undefined || test === undefined) {
    return null
  }

  return { frame: frameNextTo(test, removed), removed: removed.base.index }
}

/**
 * Pick a test from the sidebar, the keyboard or the search. Under the Changed
 * filter a marked test opens recorded at its first change, a removed frame
 * when that comes first, because the change shows in the recorded frames and
 * not in Live. Otherwise it is `select()`.
 */
export function selectAtChange(testId: string, mode: 'push' | 'replace'): void {
  const mark = state.changed ? changeMarks(state.changes).get(testId) : undefined

  if (mark === undefined) {
    select(testId, 0, mode)
    return
  }

  state.live = false

  const first = firstRemovedOf(testId, mark)

  if (first !== null) {
    select(testId, first.frame, mode, first.removed)
    return
  }

  select(testId, mark.first, mode)
}
