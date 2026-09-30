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

/**
 * Prefix of stylesheet references inside stored snapshots, e.g.
 * `describe-me-style:3f2a9c1d0b7e4a55+9c1d…`. The reporter stores an rrweb
 * `_cssText` of 256+ characters as chunks in `<outDir>/styles/<hash>.css`, and
 * the viewer joins them back in order before replaying.
 */
export const STYLE_URL_PREFIX = 'describe-me-style:' as const

/**
 * When the render frame is taken. `'eager'`: right after mount. `'lazy'`:
 * right before the test's next interaction, or at the end of the test.
 * `{ pending, timeout }`: as soon as nothing matches the CSS selector
 * `pending` and the page shows content, falling back to `'lazy'` after
 * `timeout` ms (default 2000) or at an earlier interaction.
 */
export type RenderFrameMode = 'eager' | 'lazy' | { pending: string; timeout?: number }

/** Options for `recorder.configure()`. */
export interface RecorderOptions {
  /** When the render frame is taken. Default: `'eager'`. */
  renderFrame?: RenderFrameMode
}

/** Options for `recorder.capture()`. */
export interface CaptureOptions {
  /**
   * Wait one macrotask for the framework to flush before looking at the DOM.
   * Default: true. Pass false when the caller knows the DOM is already
   * committed (e.g. right after Testing Library's `act()`-wrapped `rerender`):
   * the snapshot is then taken and the frame recorded before `capture()`
   * returns, so the caller can move on without awaiting it. Render frames
   * follow `renderFrame` (see `RecorderOptions`), which may defer them.
   */
  settle?: boolean
  /**
   * `recorder.generation` as read when the interaction began. A capture from
   * an earlier test is dropped. Default: the current generation.
   */
  generation?: number
}

/** A frame as captured by the recorder. `snapshot` is the DOM, already serialized to JSON. */
export interface Frame {
  id: string
  kind: FrameKind
  label: string
  /** when the snapshot was taken, in ms since the test began */
  at: number
  meta?: Record<string, unknown>
  /** rrweb serialized document, as JSON text */
  snapshot: string
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
  /**
   * Stable across runs and machines: the first 12 hex characters of a SHA-1 of
   * the module path, the suite path, the name and, for a repeated name, its
   * occurrence. Before 0.5 it was Vitest's id.
   */
  id: string
  /** Vitest's `TestCase.id` in the run that recorded the test. Absent in manifests written before 0.5. */
  vitestId?: string
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

/** The package that wrote a manifest. */
export interface ManifestGenerator {
  /** The package name, e.g. `@describe-me/vitest`. */
  name: string
  /** Its version, e.g. `0.5.1`. */
  version: string
}

export interface Manifest {
  version: 1
  /** The package and version that wrote the manifest. Absent in manifests written before 0.5.1. */
  generator?: ManifestGenerator
  generatedAt: string
  root: string
  modules: ManifestModule[]
  /** Keyed by component name, as reported by the framework adapter. */
  components: Record<string, ComponentDoc>
  /**
   * Asset URLs the snapshots, the preview head or copied CSS files point at
   * that could not be found in the project, as root-relative paths
   * (`/lib/images/logo.svg`). Paths outside the root use the `/@fs/` form.
   * They will not load in the viewer. Absent in manifests written before 0.4.
   */
  assetsMissing?: string[]
  /**
   * The preview head HTML, with project files as `describe-me-asset:` URLs.
   * Absent when `previewHead` is not set.
   */
  head?: string
  /**
   * Font families that frames use but nothing loads, most tests first. Absent
   * in manifests written before 0.5, which counts as empty.
   */
  fontsMissing?: FontMissing[]
  /**
   * Hosts that frames load stylesheets from, most frames first. Absent in
   * manifests written before 0.5, which counts as empty.
   */
  remoteStylesheets?: RemoteStylesheet[]
  /**
   * Problems the plugin found in the project's setup, one sentence each.
   * Absent when there are none and in manifests written before 0.5.1, which
   * counts as empty.
   */
  setupWarnings?: string[]
}

/** A font family that the captured CSS uses but no `@font-face`, font stylesheet or preview head loads. */
export interface FontMissing {
  /** The family as first spelled in manifest order. */
  family: string
  /** Tests with at least one frame that misses it. */
  tests: number
  /** `ManifestTest.id` of the first such test, in manifest order. */
  testId: string
}

/** A host that frames load stylesheets from, which the viewer fetches from the network. */
export interface RemoteStylesheet {
  /** The URL's hostname. */
  host: string
  /** Frames that link or import at least one stylesheet from it. */
  frames: number
}

/** The name adapters fall back to when a component has no usable name. */
export const ANONYMOUS_COMPONENT = 'Anonymous' as const

/** What keeps a manifest from documenting everything its tests rendered. */
export interface ManifestDiagnostics {
  /** Tests whose rendered component has no usable name. */
  anonymous: { testId: string; fullName: string }[]
  /** Named components without a props doc, with how many tests rendered each. */
  undocumented: { name: string; tests: number }[]
  /** Asset paths that will not load in the viewer, root-relative or in the `/@fs/` form. */
  assetsMissing: string[]
  /** Font families that frames use but nothing loads. */
  fontsMissing: FontMissing[]
  /** Hosts that frames load stylesheets from. */
  remoteStylesheets: RemoteStylesheet[]
  /** Problems in the project's setup that can make tests fail. */
  setupWarnings: string[]
}
