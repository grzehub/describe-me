import type { ManifestGenerator, TestState } from '@describe-me/core/types'

/** The contents of `changes.json`, which `describe-me diff --out` writes. */
export interface ChangesReport {
  version: 1
  /** The run of `--base`. */
  base: ChangesRun
  /** The run of `--data`. */
  head: ChangesRun
  /** The manifests name different versions, or only one names its version. */
  versionsDiffer: boolean
  counts: ChangesCounts
  /** Changed, added and moved tests in head order, then removed tests in base order. */
  tests: TestChange[]
  /** Components on both sides whose props differ, by name. */
  components: ComponentChange[]
  /** What `--shots` compared and wrote. Absent without it. */
  shots?: ShotsSummary
}

/** What `--shots` rendered, compared and wrote. */
export interface ShotsSummary {
  /** The frame width in CSS pixels. */
  width: number
  /** Device pixels per CSS pixel in the images. */
  pixelRatio: number
  /** The most images `--shots` writes. */
  maxShots: number
  /** Distinct pairs of changed frames compared. */
  pairs: number
  differentPairs: number
  /** Pairs left without `look` because a side did not render. */
  failedPairs: number
  /** Images written to `--out`. */
  images: number
}

/** One side of the comparison. */
export interface ChangesRun {
  /** The manifest's `generator`. Absent for one written before 0.5.1. */
  generator?: ManifestGenerator
  generatedAt: string
}

/** How many tests and frames changed in each way. */
export interface ChangesCounts {
  tests: TestCounts
  frames: FrameCounts
}

/** `changed` counts every changed test, `dom` and `css` count them by kind. */
export interface TestCounts {
  changed: number
  dom: number
  css: number
  added: number
  removed: number
  moved: number
  unchanged: number
}

/** `changed` is `dom` + `css`. `unchanged` counts the frames matched by name. */
export interface FrameCounts {
  changed: number
  dom: number
  css: number
  added: number
  removed: number
  unchanged: number
}

/** `dom`: the snapshot differs without its stylesheet text. `css`: only the stylesheet text differs. */
export type ChangeKind = 'dom' | 'css'

/** How a pair of changed frames renders in Chromium. */
export type Look = 'same' | 'different'

/** A test that differs between the runs. */
export interface TestChange {
  change: 'changed' | 'added' | 'removed' | 'moved'
  /** The head's id, the base's for a removed test. */
  id: string
  /** `ManifestModule.id` on the side of `id`. */
  module: string
  fullName: string
  /** Only on `changed`. Absent when only the state changed. */
  kind?: ChangeKind
  /**
   * Only on `changed`, only with `--shots`. `different` when a pair looks
   * different, `same` when every pair looks the same and no frame was added or
   * removed. Absent otherwise.
   */
  look?: Look
  /** The image in `--out` and the head index of the frame it shows. */
  shot?: TestShot
  /** Only when the state differs. */
  state?: StateChange
  /** Where a moved test was in the base. */
  from?: TestPlace
  /** Changed, added and removed frames in order. Every frame of an added or removed test. Empty for a moved test. */
  frames: FrameChange[]
}

/** An image that `--shots` wrote for a test. */
export interface TestShot {
  /** The file name in `--out`. */
  file: string
  /** The head index of the frame it shows. */
  frame: number
}

/** The state of a test on each side. */
export interface StateChange {
  base: TestState
  head: TestState
}

/** A test of the base, as a moved test names it. */
export interface TestPlace {
  id: string
  module: string
  fullName: string
}

/** A frame that differs between the runs. */
export interface FrameChange {
  change: 'changed' | 'added' | 'removed'
  /** Only on `changed`. */
  kind?: ChangeKind
  /** Only on `changed`, only with `--shots`. Absent when a side did not render. */
  look?: Look
  /** Absent on `added`. */
  base?: FrameSide
  /** Absent on `removed`. */
  head?: FrameSide
}

/** A frame on one side. */
export interface FrameSide {
  /** The frame's place in its test on that side, from 0. */
  index: number
  label: string
  /** `ManifestFrame.snapshot`, relative to that side's directory. */
  snapshot: string
}

/** A component on both sides whose props differ. */
export interface ComponentChange {
  name: string
  props: PropChange[]
}

/** A prop that differs between the runs. */
export interface PropChange {
  name: string
  change: 'added' | 'removed' | 'changed'
  /** Absent on `added`. */
  base?: PropSide
  /** Absent on `removed`. */
  head?: PropSide
}

/** What a prop is on one side. */
export interface PropSide {
  type: string
  required: boolean
  defaultValue?: string
}
