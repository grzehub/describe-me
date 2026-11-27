import type { Manifest } from '@describe-me/core/types'
import type { ChangesReport, FrameChange, Look, TestChange } from './changes-report.js'
import type { ShotSide } from './render-shot.js'
import type { IndexedTest } from './test-index.js'
import { testIndex } from './test-index.js'

/** A distinct pair of changed frames: a snapshot of the base and one of the head. */
export interface ShotPair {
  base: ShotSide
  head: ShotSide
  /** Set once both sides rendered and were compared. */
  look?: Look
}

/** The frame an added test's image shows. */
export interface AddedShot {
  test: TestChange
  /** Its head index. */
  frame: number
  head: ShotSide
}

/** What `--shots` renders for a report. */
export interface ShotPlan {
  /** Every distinct pair once, in report order. */
  pairs: ShotPair[]
  /** The pair of each changed frame of a changed test. */
  pairOf: Map<FrameChange, ShotPair>
  /** The added tests that have a frame to show, in report order. */
  added: AddedShot[]
}

/** The first render frame of a test, or else its first frame. */
function shownFrame(test: TestChange, headTests: Map<string, IndexedTest>): number {
  const frames = headTests.get(test.id)?.test.frames ?? []
  const render = frames.findIndex((frame) => frame.kind === 'render')

  return render < 0 ? 0 : render
}

function addedShot(test: TestChange, headTests: Map<string, IndexedTest>): AddedShot | null {
  const frame = shownFrame(test, headTests)
  const snapshot = test.frames.find((entry) => entry.head?.index === frame)?.head?.snapshot

  return snapshot === undefined ? null : { test, frame, head: { side: 'head', snapshot } }
}

/**
 * The pairs of changed frames to compare and the added tests that may get an
 * image. A pair is the changed frames of a changed test, once for each
 * distinct pair of snapshots. Moved and removed tests render nothing. An added
 * test shows its first frame of kind `render` in `head`, or else its first frame.
 */
export function shotPlan(report: ChangesReport, head: Manifest): ShotPlan {
  const byKey = new Map<string, ShotPair>()
  const pairOf = new Map<FrameChange, ShotPair>()

  for (const test of report.tests.filter((entry) => entry.change === 'changed')) {
    for (const frame of test.frames) {
      if (frame.change !== 'changed' || frame.base === undefined || frame.head === undefined) {
        continue
      }

      const key = JSON.stringify([frame.base.snapshot, frame.head.snapshot])
      let pair = byKey.get(key)

      if (pair === undefined) {
        pair = {
          base: { side: 'base', snapshot: frame.base.snapshot },
          head: { side: 'head', snapshot: frame.head.snapshot },
        }

        byKey.set(key, pair)
      }

      pairOf.set(frame, pair)
    }
  }

  const headTests = testIndex(head)
  const added = report.tests
    .filter((test) => test.change === 'added')
    .map((test) => addedShot(test, headTests))
    .filter((shot) => shot !== null)

  return { pairs: [...byKey.values()], pairOf, added }
}
