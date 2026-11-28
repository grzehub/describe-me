import type { ManifestTest } from '@describe-me/core/types'
import type { ChangeMark } from './change-marks.js'
import { changeMarks } from './change-marks.js'
import { filterActive } from './filter-active.js'
import { frameNextTo } from './frame-next-to.js'
import { hasFoundations } from './has-foundations.js'
import { resolveTestId } from './resolve-test-id.js'
import { sidebarOrder } from './sidebar-order.js'
import { stateHash } from './state-hash.js'
import { allTests, currentTest, state, writeHash } from './state.js'
import { visibleTests } from './visible-tests.js'

/**
 * The sidebar's first test, or the first a filter leaves, so a link with only
 * a tag opens one of its tests.
 */
function firstTest(): ManifestTest | undefined {
  const shown = filterActive() ? visibleTests() : []

  return shown[0] ?? sidebarOrder()[0]
}

/** Whether a test of the manifest changed or was added against the base. */
function anyMarked(): boolean {
  const marks = changeMarks(state.changes)

  return state.manifest !== null && allTests(state.manifest).some((test) => marks.has(test.id))
}

/** The first test the sidebar leaves, recorded at its first change under the Changed filter. */
function fallBack(): void {
  state.testId = firstTest()?.id ?? null
  state.frame = 0
  state.before = false
  state.removedFrame = null

  const mark = state.changed ? changeMarks(state.changes).get(state.testId ?? '') : undefined

  if (mark !== undefined) {
    state.live = false
    state.frame = mark.first
    state.removedFrame = mark.firstRemoved
  }
}

/**
 * A removed frame stays only when the mark has it, and the frame next to it
 * stays selected. Before stays only on a changed frame of the current run.
 */
function keepSides(test: ManifestTest, mark: ChangeMark | undefined): void {
  const removed = mark?.removed.find((frame) => frame.base.index === state.removedFrame)

  if (removed === undefined) {
    state.removedFrame = null
  } else {
    state.frame = frameNextTo(test, removed)
  }

  state.before =
    state.before && state.removedFrame === null && mark?.pairs.has(state.frame) === true
}

/**
 * Point the selection at a test the manifest holds, falling back to the
 * sidebar's first one the search, the tag and the Changed filter leave, and
 * clamp the frame. A test the Changed filter picks opens recorded at its
 * first change, which may be a removed frame. The Changed filter turns off
 * when nothing is marked. Before and a removed frame stay only where the
 * report has them, and never in Live.
 * Foundations closes when the manifest has neither tokens nor Material UI, and
 * an open Foundations drops the suite.
 * The link is corrected in place, without a history entry. Does not repaint.
 */
export function syncSelection(): void {
  if (!state.manifest) {
    return
  }

  if (!hasFoundations(state.manifest.foundations)) {
    state.foundations = null
  }

  if (state.foundations !== null) {
    state.suiteKey = null
  }

  if (state.changed && !anyMarked()) {
    state.changed = false
  }

  const resolved = resolveTestId(state.manifest, state.testId)
  if (resolved) {
    state.testId = resolved
  } else {
    fallBack()
  }

  const test = currentTest()
  if (test) {
    state.frame = Math.min(state.frame, Math.max(0, test.frames.length - 1))
  }

  if (state.live || !test) {
    state.before = false
    state.removedFrame = null
  } else {
    keepSides(test, changeMarks(state.changes).get(test.id))
  }

  if (stateHash(state) !== location.hash.slice(1)) {
    writeHash('replace')
  }
}
