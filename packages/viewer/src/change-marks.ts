import type {
  ChangeKind,
  ChangesReport,
  FrameChange,
  FrameSide,
  TestChange,
} from '../cli/changes-report.js'

/** How a frame of the timeline differs from the base. */
export type FrameMark = ChangeKind | 'added'

/** A frame of the base that the current run lacks, and where it stands in the timeline. */
export interface RemovedFrame {
  base: FrameSide
  /** The index in the current run of the frame it follows, -1 at the start. */
  after: number
}

/** What the viewer marks on a test that changed or was added against the base. */
export interface ChangeMark {
  change: 'changed' | 'added'
  /** Absent when only the state changed, and on an added test. */
  kind?: ChangeKind
  /** By the frame's index in the current run. */
  frames: Map<number, FrameMark>
  /** The lowest index of `frames`, 0 when it is empty. */
  first: number
  /** The base side of each changed frame, by its index in the current run. */
  pairs: Map<number, FrameSide>
  /** In base order. */
  removed: RemovedFrame[]
  /**
   * The base index of the first removed frame when it comes before every frame
   * of `frames`, else `null`.
   */
  firstRemoved: number | null
}

const NONE: ReadonlyMap<string, ChangeMark> = new Map()
const memo = new WeakMap<ChangesReport, Map<string, ChangeMark>>()

/** A base index the walk can reach, so it ends even on a report that is not consistent. */
function isPlaceable(index: number): boolean {
  return Number.isSafeInteger(index) && index >= 0
}

/**
 * Every base frame is removed or paired with one frame of the current run,
 * every frame of the current run is added or paired, and pairs keep their
 * order. So a walk over both sides puts each removed frame after the frame of
 * the current run that comes before it.
 */
function placeRemoved(frames: FrameChange[]): RemovedFrame[] {
  const removedByIndex = new Map<number, FrameSide>()
  const addedHeads = new Set<number>()

  for (const frame of frames) {
    if (frame.change === 'removed' && frame.base !== undefined && isPlaceable(frame.base.index)) {
      removedByIndex.set(frame.base.index, frame.base)
    } else if (frame.change === 'added' && frame.head !== undefined) {
      addedHeads.add(frame.head.index)
    }
  }

  const placed: RemovedFrame[] = []
  let base = 0
  let head = 0

  while (placed.length < removedByIndex.size) {
    const side = removedByIndex.get(base)

    if (side !== undefined) {
      placed.push({ base: side, after: head - 1 })
      base++
    } else if (addedHeads.has(head)) {
      head++
    } else {
      base++
      head++
    }
  }

  return placed
}

function markOf(entry: TestChange, change: ChangeMark['change']): ChangeMark {
  const frames = new Map<number, FrameMark>()
  const pairs = new Map<number, FrameSide>()

  for (const frame of entry.frames) {
    if (frame.head === undefined) {
      continue
    }

    if (frame.change === 'added') {
      frames.set(frame.head.index, 'added')
    } else if (frame.change === 'changed' && frame.kind !== undefined) {
      frames.set(frame.head.index, frame.kind)

      if (frame.base !== undefined) {
        pairs.set(frame.head.index, frame.base)
      }
    }
  }

  const first = frames.size === 0 ? 0 : Math.min(...frames.keys())
  const removed = placeRemoved(entry.frames)
  const leading = removed[0]
  const firstRemoved =
    leading !== undefined && (frames.size === 0 || leading.after < first)
      ? leading.base.index
      : null

  const mark: ChangeMark = { change, frames, first, pairs, removed, firstRemoved }

  if (entry.kind !== undefined) {
    mark.kind = entry.kind
  }

  return mark
}

function build(report: ChangesReport): Map<string, ChangeMark> {
  const marks = new Map<string, ChangeMark>()

  for (const entry of report.tests) {
    // A moved test keeps its snapshots, and a removed one has no row.
    if (entry.change !== 'changed' && entry.change !== 'added') {
      continue
    }

    marks.set(entry.id, markOf(entry, entry.change))
  }

  return marks
}

/**
 * The marks of a report by the test's id in the current run, built once per
 * report. An id the manifest lacks is never looked up, so it marks nothing.
 * No report gives no marks.
 */
export function changeMarks(report: ChangesReport | null): ReadonlyMap<string, ChangeMark> {
  if (report === null) {
    return NONE
  }

  let marks = memo.get(report)

  if (marks === undefined) {
    marks = build(report)
    memo.set(report, marks)
  }

  return marks
}
