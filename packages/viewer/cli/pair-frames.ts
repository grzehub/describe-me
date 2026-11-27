import type { ManifestFrame } from '@describe-me/core/types'
import type { ChangeKind, FrameChange, FrameSide } from './changes-report.js'
import { commonSubsequence } from './common-subsequence.js'

/** The DOM key of a frame's snapshot on one side. */
export type DomKeyOf = (side: 'base' | 'head', snapshot: string) => string

/** The changed, added and removed frames of a test, and how many kept their snapshot. */
export interface FramePairing {
  frames: FrameChange[]
  unchanged: number
}

interface Sides {
  base: ManifestFrame[]
  head: ManifestFrame[]
}

function sideOf(frames: ManifestFrame[], index: number): FrameSide {
  const frame = frames[index]

  return { index, label: String(frame.label ?? ''), snapshot: frame.snapshot }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i)
}

function changed(sides: Sides, kind: ChangeKind, base: number, head: number): FrameChange {
  return {
    change: 'changed',
    kind,
    base: sideOf(sides.base, base),
    head: sideOf(sides.head, head),
  }
}

/** Pairs in order as DOM changes, the rest as removed and added frames. */
function pairInOrder(sides: Sides, base: number[], head: number[]): FrameChange[] {
  const paired = Math.min(base.length, head.length)
  const changes: FrameChange[] = []

  for (let i = 0; i < paired; i++) {
    changes.push(changed(sides, 'dom', base[i], head[i]))
  }

  for (const index of base.slice(paired)) {
    changes.push({ change: 'removed', base: sideOf(sides.base, index) })
  }

  for (const index of head.slice(paired)) {
    changes.push({ change: 'added', head: sideOf(sides.head, index) })
  }

  return changes
}

/** Frames between two unchanged ones: same DOM key first, as CSS changes, then the rest in order. */
function pairGap(sides: Sides, base: number[], head: number[], domKeyOf: DomKeyOf): FrameChange[] {
  if (base.length === 0 || head.length === 0) {
    return pairInOrder(sides, base, head)
  }

  const cssPairs = commonSubsequence(
    base.map((index) => domKeyOf('base', sides.base[index].snapshot)),
    head.map((index) => domKeyOf('head', sides.head[index].snapshot)),
  )

  const changes: FrameChange[] = []
  let baseFrom = 0
  let headFrom = 0

  for (const [baseAt, headAt] of cssPairs) {
    changes.push(...pairInOrder(sides, base.slice(baseFrom, baseAt), head.slice(headFrom, headAt)))
    changes.push(changed(sides, 'css', base[baseAt], head[headAt]))
    baseFrom = baseAt + 1
    headFrom = headAt + 1
  }

  changes.push(...pairInOrder(sides, base.slice(baseFrom), head.slice(headFrom)))

  return changes
}

/**
 * Match the frames of a test on both sides. Equal snapshot names are
 * unchanged frames. Between them, frames with the same DOM key changed only
 * in CSS, and the rest pair in order as DOM changes, so one step added in the
 * middle is one added frame even when the global stylesheet changed.
 * `domKeyOf` is called only for frames between unchanged ones.
 */
export function pairFrames(
  base: ManifestFrame[],
  head: ManifestFrame[],
  domKeyOf: DomKeyOf,
): FramePairing {
  const sides = { base, head }
  const unchanged = commonSubsequence(
    base.map((frame) => frame.snapshot),
    head.map((frame) => frame.snapshot),
  )

  const frames: FrameChange[] = []
  let baseFrom = 0
  let headFrom = 0

  for (const [baseAt, headAt] of unchanged) {
    frames.push(...pairGap(sides, range(baseFrom, baseAt), range(headFrom, headAt), domKeyOf))
    baseFrom = baseAt + 1
    headFrom = headAt + 1
  }

  frames.push(
    ...pairGap(sides, range(baseFrom, base.length), range(headFrom, head.length), domKeyOf),
  )

  return { frames, unchanged: unchanged.length }
}
