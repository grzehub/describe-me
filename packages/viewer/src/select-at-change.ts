import { changeMarks } from './change-marks.js'
import { select, state } from './state.js'

/**
 * Pick a test from the sidebar, the keyboard or the search. Under the Changed
 * filter a marked test opens recorded at its first change, because the
 * change shows in the recorded frames and not in Live. Otherwise it is
 * `select()`.
 */
export function selectAtChange(testId: string, mode: 'push' | 'replace'): void {
  const mark = state.changed ? changeMarks(state.changes).get(testId) : undefined

  if (mark === undefined) {
    select(testId, 0, mode)
    return
  }

  state.live = false
  select(testId, mark.first, mode)
}
