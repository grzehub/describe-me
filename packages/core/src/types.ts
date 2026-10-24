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
 * Attribute that holds an element's states in a stored snapshot, as names
 * separated by spaces, always in the order `hover focus focus-visible
 * focus-within`. Only the serialized tree has it, never the page.
 */
export const PSEUDO_STATES_ATTRIBUTE = 'data-describe-me-states' as const

/** A pseudo-class state that a frame records for an element. */
export type PseudoState = 'hover' | 'focus' | 'focus-visible' | 'focus-within'

/** Where the tests run. These are the values of the plugin's `environment` option. */
export type RecorderEnvironment = 'browser' | 'dom'

/** What a gesture did to hover and focus, as adapters report it to `recorder.noteGesture()`. */
export type GestureKind = 'hover' | 'unhover' | 'pointer' | 'keyboard'

/**
 * When the render frame is taken. `'eager'`: right after mount. `'lazy'`:
 * right before the test's next interaction, or at the end of the test.
 * `{ pending, timeout }`: as soon as nothing matches the CSS selector
 * `pending` and the page shows content, falling back to `'lazy'` after
 * `timeout` ms (default 2000) or at an earlier interaction.
 */
export type RenderFrameMode = 'eager' | 'lazy' | { pending: string; timeout?: number }

/** Runs one wait of the recorder. It must call `wait` once and resolve after it. */
export type AroundWait = (wait: () => Promise<void>) => Promise<void>

/** Options for `recorder.configure()`. */
export interface RecorderOptions {
  /** When the render frame is taken. Default: `'eager'`. */
  renderFrame?: RenderFrameMode
  /**
   * Runs each wait of the recorder. It is kept when omitted, so a later
   * `configure({ renderFrame })` keeps the setup file's wrapper. By default
   * it runs `wait` as is.
   */
  aroundWait?: AroundWait
  /**
   * Where the tests run, which decides how a frame reads hover and focus. It
   * is kept when omitted, like `aroundWait`, and is `'dom'` until a setup
   * file sets it.
   */
  environment?: RecorderEnvironment
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

/**
 * The Vitest tag that picks a test, a suite or a file for the docs when the
 * plugin's `stories` is `'tagged'`. The viewer leaves it out of a test's tags.
 */
export const DOCS_TAG = 'docs' as const

/** The Vitest tag that keeps a test, a suite or a file out of the docs, whatever `stories` says. */
export const NO_DOCS_TAG = 'no-docs' as const

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
  /** Vitest tags, its own and inherited, when it has any. Absent in manifests written before 0.7. */
  tags?: string[]
  state: TestState
  duration?: number
  /**
   * The errors of a failed test. A path under the root or a folder above it is
   * relative to the root, unless that folder sits right under `/`.
   */
  errors?: { message: string; stack?: string }[]
  component?: ComponentInfo
  frames: ManifestFrame[]
}

export interface ManifestModule {
  /** module path relative to project root */
  id: string
  /**
   * The module's sidebar group, outermost first, from the plugin's
   * `sidebar.groups`. Absent for a file that no group matches, without the
   * option, and in manifests written before 0.12.
   */
  group?: string[]
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
  /**
   * The Vitest root of the run, as an absolute path. In the copy that
   * `describe-me build` writes into a site, it is an id of the project.
   */
  root: string
  /**
   * The Vitest config file of the run, relative to `root`, with `/` separators.
   * Absent when the run had no config file, and in manifests written before 0.6.
   */
  configFile?: string
  /**
   * The name of the project: the `name` of the nearest package.json at or
   * above `root`, else the root directory's name. The viewer's header and
   * tab title show it. Absent in manifests written before 0.10.
   */
  project?: string
  modules: ManifestModule[]
  /**
   * The sidebar groups that hold a test file, directly or in a subgroup, each
   * as its path from the outermost group, in sidebar order: depth first, each
   * group before its subgroups. Absent without `sidebar.groups`, when no file
   * has a group, and in manifests written before 0.12.
   */
  sidebar?: { groups: string[][] }
  /** Keyed by component name, as reported by the framework adapter. */
  components: Record<string, ComponentDoc>
  /**
   * Asset URLs the snapshots, the preview head or copied CSS files point at
   * that could not be found in the project, as root-relative paths
   * (`/lib/images/logo.svg`). A path outside the root starts at its last
   * `node_modules/` (`node_modules/pkg/logo.svg`) or else is relative to the
   * root (`../shared/logo.svg`). They will not load in the viewer. Absent in
   * manifests written before 0.4.
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
   * Problems the plugin or the reporter found in the project's setup, such as
   * a sidebar group that gets no test file, one sentence each. Absent when
   * there are none and in manifests written before 0.5.1, which counts as
   * empty.
   */
  setupWarnings?: string[]
  /**
   * What `foundations.json` next to the manifest holds. Absent in manifests
   * written before 0.9, with `foundations: false`, and when the run found no
   * token, no problem and no Material UI.
   */
  foundations?: ManifestFoundations
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
  /**
   * Asset paths that will not load in the viewer: root-relative inside the
   * root, and `node_modules/…` or `../…` outside it.
   */
  assetsMissing: string[]
  /** Font families that frames use but nothing loads. */
  fontsMissing: FontMissing[]
  /** Hosts that frames load stylesheets from. */
  remoteStylesheets: RemoteStylesheet[]
  /**
   * Problems in the project's setup, such as a dependency that can make tests
   * fail or a sidebar group that gets no test file.
   */
  setupWarnings: string[]
  /** Problems reading the design-system foundations. */
  foundationsErrors: string[]
}

// ---------- foundations ----------

/** A design system the reporter can name. */
export type DesignSystemId =
  | 'tailwind'
  | 'shadcn'
  | 'mui'
  | 'chakra'
  | 'mantine'
  | 'radix-themes'
  | 'styled-components'
  | 'emotion'
  | 'antd'

/** The section of the Foundations view a token belongs to. */
export type FoundationGroup =
  'colors' | 'typography' | 'spacing' | 'radius' | 'shadows' | 'breakpoints' | 'motion' | 'other'

/** What a token's value is, named after the `$type` values of the DTCG format. */
export type FoundationTokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'number'
  | 'duration'
  | 'cubicBezier'
  | 'shadow'
  | 'typography'

/** One token from the Tailwind theme or from the JS theme module. */
export interface FoundationToken {
  /** `--color-brand-500` for Tailwind, a dotted path such as `palette.primary.main` for a JS theme. */
  name: string
  group: FoundationGroup
  /** Absent when the value fits no type. */
  type?: FoundationTokenType
  /** The value as CSS text, in the light mode when the token has modes. */
  value: string
  /** The value per color scheme, when the token has both. */
  modes?: { light: string; dark: string }
  /**
   * `default` for a framework default: Tailwind's `DEFAULT` flag, or a Material
   * UI value that equals Material UI's own default in every mode and every
   * part. `project` otherwise.
   */
  origin: 'project' | 'default'
  /**
   * The origin per color scheme, present only when the token has modes and
   * exactly one of them equals the framework default. `origin` is then `project`.
   */
  modeOrigins?: { light: 'project' | 'default'; dark: 'project' | 'default' }
  source: 'tailwind' | 'theme'
  /** The parts of a composite token, such as `{ fontSize, lineHeight }`, keyed by camelCase CSS property. */
  parts?: Record<string, string>
}

/** A recorded stylesheet, as the snapshots keep it. */
export interface FoundationsSheet {
  /** `describe-me-style:<hash>+<hash>…` for a stored sheet, or the CSS text of one short enough to stay inline. */
  cssText: string
  /** Its `data-vite-dev-id`, relative to the root or starting at `node_modules/`, when Vite inserted it. */
  source?: string
}

/** A design system the project uses. */
export interface FoundationsSystem {
  id: DesignSystemId
  /** The npm package it was found by. Absent for shadcn, which `components.json` names. */
  package?: string
  /** The installed version. Absent when it cannot be read. */
  version?: string
}

/** The contents of `foundations.json`, which the reporter writes next to `manifest.json`. */
export interface Foundations {
  version: 1
  systems: FoundationsSystem[]
  /** From `components.json`, when the project has one. */
  shadcn?: { style?: string; baseColor?: string; css?: string }
  /** Sheets that declare custom properties on a root-like selector, in first-appearance order. */
  tokenSheets: FoundationsSheet[]
  /** Sheets with `@font-face`, in first-appearance order. A sheet may be in both lists. */
  fontSheets: FoundationsSheet[]
  /** Project CSS files the frames load, relative to the root, none under `node_modules/`. */
  cssSources: string[]
  /** The Tailwind 4 entry file, relative to the root, when one was found. */
  tailwind?: { entry: string }
  /** The theme module of `foundations.theme`, when it loaded. */
  theme?: { module: string; export: string; adapter: 'mui' | 'object' }
  /** Tokens of the Tailwind theme, then of the JS theme. The viewer reads custom properties from the sheets. */
  tokens: FoundationToken[]
  /** Problems while collecting, one sentence each. */
  errors: string[]
  /** How long collecting took, in whole ms. */
  duration: number
}

/** What the manifest says about `foundations.json`. */
export interface ManifestFoundations {
  systems: DesignSystemId[]
  /** Distinct token names across the token sheets, the Tailwind theme and the JS theme. */
  tokens: number
  /** Problems while collecting, one sentence each. Absent when there are none. */
  errors?: string[]
}

// ---------- live preview (messages both ways between the live page and the viewer) ----------

/** How the live preview page ended up. */
export type LiveStatus =
  'mounted' | 'no-render' | 'not-found' | 'import-failed' | 'setup-failed' | 'failed'

/** The `source` of every message the live preview page posts. */
export const LIVE_MESSAGE_SOURCE = 'describe-me-live' as const

/** The version of the contract between the viewer, the plugin's live mode and the live page. */
export const LIVE_PROTOCOL = 1 as const

/** What the live page reports, without the `source` field. */
export type LiveReport =
  | { type: 'status'; status: LiveStatus; detail?: string }
  | { type: 'size'; height: number }
  | { type: 'action'; name: string; args: string[] }
  | { type: 'error'; message: string }
  | { type: 'notice'; message: string }
  /** The computed `background-color` of `<html>` and of `<body>`, so the viewer can paint its canvas to match. */
  | { type: 'background'; html: string; body: string }

/** A message the live page posts to the viewer around it. */
export type LiveMessage = LiveReport & { source: typeof LIVE_MESSAGE_SOURCE }

/** The `source` of every message the viewer posts to the live preview page. */
export const VIEWER_MESSAGE_SOURCE = 'describe-me-viewer' as const

/** What turns a project's dark variant on at the root element. */
export interface DarkVariantRoot {
  /** A class on the root, such as `'dark'` for `.dark`. */
  className?: string
  /** A `data-*` attribute on the root, such as `{ name: 'data-theme', value: 'dark' }`. */
  attribute?: { name: string; value: string }
}

/** What the viewer asks of the live page, without the `source` field. `root: null` takes back what the page applied. */
export type ViewerRequest = { type: 'dark-variant'; root: DarkVariantRoot | null }

/** A message the viewer posts to the live page in its frame. A page ignores a `type` it does not know. */
export type ViewerMessage = ViewerRequest & { source: typeof VIEWER_MESSAGE_SOURCE }
