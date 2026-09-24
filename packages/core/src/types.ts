/** Shared, JSON-serializable types. Safe to import from Node (no DOM). */

export type FrameKind = 'render' | 'action' | 'step' | 'end'

export interface ComponentInfo {
  name: string
  props: Record<string, unknown>
  /**
   * Source file that defines the component, relative to the project root, when
   * the plugin registered its module's exports. Lets the reporter read props
   * without guessing the file from the test's imports.
   */
  file?: string
}

/** What the plugin registers for every top-level export of a project module. */
export interface RegisteredExport {
  /** The export name in the defining module, e.g. `Button`. */
  name: string
  /** The defining module, relative to the project root, posix separators. */
  file: string
}

/**
 * `Symbol.for()` key of the registry on `globalThis`: a
 * `WeakMap<object, RegisteredExport>` filled by code the plugin appends to
 * project modules. A global rather than an import, because a user's module
 * cannot always resolve `@describe-me/core` (pnpm) and a bundled adapter may
 * carry its own copy of core.
 */
export const EXPORT_REGISTRY_KEY = 'describe-me.exports' as const

/**
 * Prefix of project asset URLs inside stored snapshots, e.g.
 * `describe-me-asset:3f2a9c1d.svg`. The reporter copies the file to
 * `<outDir>/assets/` and the viewer resolves the prefix against `__data/assets/`.
 */
export const ASSET_URL_PREFIX = 'describe-me-asset:' as const

/** Options for `recorder.capture()`. */
export interface CaptureOptions {
  /**
   * Wait one macrotask for the framework to flush before looking at the DOM.
   * Default: true. Pass false when the caller knows the DOM is already
   * committed (e.g. right after Testing Library's `act()`-wrapped `rerender`):
   * the snapshot is then taken synchronously, before the caller moves on.
   */
  settle?: boolean
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
  /**
   * `location.origin` of the page the test ran in (`http://localhost:3000` in
   * jsdom, the Vitest server in browser mode). rrweb makes every URL absolute
   * against it, so the reporter uses it to find project assets.
   */
  origin?: string
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
  /**
   * Asset URLs the snapshots point at on the test page's origin that could not
   * be found in the project, as root-relative paths (`/lib/images/logo.svg`).
   * They will not load in the viewer. Absent in manifests written before 0.4.
   */
  assetsMissing?: string[]
}

/** The name adapters fall back to when a component has no usable name. */
export const ANONYMOUS_COMPONENT = 'Anonymous' as const

/** What keeps a manifest from documenting everything its tests rendered. */
export interface ManifestDiagnostics {
  /** Tests whose rendered component has no usable name. */
  anonymous: { testId: string; fullName: string }[]
  /** Named components without a props doc, with how many tests rendered each. */
  undocumented: { name: string; tests: number }[]
  /** Root-relative asset paths that will not load in the viewer. */
  assetsMissing: string[]
}
