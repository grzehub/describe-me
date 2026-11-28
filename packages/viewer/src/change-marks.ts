import type { ChangeKind, ChangesReport } from '../cli/changes-report.js'

/** How a frame of the timeline differs from the base. */
export type FrameMark = ChangeKind | 'added'

/** What the viewer marks on a test that changed or was added against the base. */
export interface ChangeMark {
  change: 'changed' | 'added'
  /** Absent when only the state changed, and on an added test. */
  kind?: ChangeKind
  /** By the frame's index in the current run. */
  frames: Map<number, FrameMark>
  /** The lowest index of `frames`, 0 when it is empty. */
  first: number
}

const NONE: ReadonlyMap<string, ChangeMark> = new Map()
const memo = new WeakMap<ChangesReport, Map<string, ChangeMark>>()

function build(report: ChangesReport): Map<string, ChangeMark> {
  const marks = new Map<string, ChangeMark>()

  for (const entry of report.tests) {
    // A moved test keeps its snapshots, and a removed one has no row.
    if (entry.change !== 'changed' && entry.change !== 'added') {
      continue
    }

    const frames = new Map<number, FrameMark>()

    for (const frame of entry.frames) {
      if (frame.head === undefined) {
        continue
      }

      if (frame.change === 'added') {
        frames.set(frame.head.index, 'added')
      } else if (frame.change === 'changed' && frame.kind !== undefined) {
        frames.set(frame.head.index, frame.kind)
      }
    }

    const first = frames.size === 0 ? 0 : Math.min(...frames.keys())
    const mark: ChangeMark = { change: entry.change, frames, first }

    if (entry.kind !== undefined) {
      mark.kind = entry.kind
    }

    marks.set(entry.id, mark)
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
