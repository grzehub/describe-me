/** Shared, JSON-serializable types. Safe to import from Node (no DOM). */

export type FrameKind = 'render' | 'action' | 'step' | 'end'

export interface ComponentInfo {
  name: string
  props: Record<string, unknown>
}

/** A frame as captured in the browser. `snapshot` is an rrweb serialized document. */
export interface Frame {
  id: string
  kind: FrameKind
  label: string
  /** ms since the test began */
  at: number
  meta?: Record<string, unknown>
  snapshot: unknown
}

/** What a single test hands over to the reporter via task.meta[META_KEY]. */
export interface TestRecord {
  frames: Frame[]
  component?: ComponentInfo
}

export const META_KEY = 'describeMe' as const

// ---------- manifest (written by the reporter, read by the viewer) ----------

export type TestState = 'passed' | 'failed' | 'skipped' | 'pending'

export interface ManifestFrame {
  id: string
  kind: FrameKind
  label: string
  at: number
  meta?: Record<string, unknown>
  /** path relative to the manifest, e.g. "snapshots/ab12.json" */
  snapshot: string
}

export interface ManifestTest {
  id: string
  name: string
  /** suite names from outermost to innermost */
  path: string[]
  fullName: string
  state: TestState
  duration?: number
  errors?: { message: string; stack?: string }[]
  component?: ComponentInfo
  frames: ManifestFrame[]
}

export interface ManifestModule {
  /** module path relative to project root */
  id: string
  tests: ManifestTest[]
}

export interface Manifest {
  version: 1
  generatedAt: string
  root: string
  modules: ManifestModule[]
}
