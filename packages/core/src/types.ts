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

/** How a prop can be covered and, later, controlled. */
export type PropKind = 'literals' | 'boolean' | 'number' | 'string' | 'function' | 'node' | 'other'

/** One prop of a component, as read from its TypeScript type. */
export interface PropDoc {
  name: string
  /** The type as TypeScript prints it, e.g. `'sm' | 'md' | 'lg'`. */
  type: string
  required: boolean
  /** Default from the destructuring pattern, as source text, e.g. `'md'` or `false`. */
  defaultValue?: string
  kind: PropKind
  /**
   * For `literals`: every member as source text (`'sm'`, `3`), in declaration order.
   * For `boolean`: `true` and `false`. Absent for other kinds.
   */
  values?: string[]
  /** Leading JSDoc comment on the prop, if any. */
  description?: string
}

/** Everything the viewer needs to document a component beyond its tests. */
export interface ComponentDoc {
  name: string
  /** Source file relative to the project root. */
  file: string
  props: PropDoc[]
}

export interface Manifest {
  version: 1
  generatedAt: string
  root: string
  modules: ManifestModule[]
  /** Keyed by component name, as reported by the framework adapter. */
  components: Record<string, ComponentDoc>
}
