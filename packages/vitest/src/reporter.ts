/**
 * Node-side Vitest reporter. Collects frames from task.meta and writes
 * `.describe-me/`: `manifest.json`, `foundations.json`, `snapshots/`,
 * `styles/` and `assets/`.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node'
import {
  META_KEY,
  type Manifest,
  type ManifestFoundations,
  type ManifestFrame,
  type ManifestGenerator,
  type ManifestModule,
  type ManifestTest,
  type TestRecord,
  type TestState,
} from '@describe-me/core/types'
import { AssetStore } from './asset-store.js'
import { cleanSnapshot } from './clean-snapshot.js'
import { collectComponentDocsSafely } from './collect-component-docs-safely.js'
import { collectFoundations, type CollectedFoundations } from './collect-foundations.js'
import { compileGlobs } from './compile-globs.js'
import { compileInclude } from './compile-include.js'
import { componentEntries } from './component-entries.js'
import { fileFilter } from './file-filter.js'
import { firstLineOf } from './first-line-of.js'
import { FontAudit } from './font-audit.js'
import type { ImportModule } from './import-theme.js'
import { isRecordedTest } from './is-recorded-test.js'
import { printDiagnostics } from './print-diagnostics.js'
import { ProjectPaths } from './project-paths.js'
import { readGenerator } from './read-generator.js'
import { RecordedSheets } from './recorded-sheets.js'
import { SnapshotStore } from './snapshot-store.js'
import { stableTestIds } from './stable-test-ids.js'
import type { StoriesMode } from './stories-mode.js'
import { StyleStore } from './style-store.js'
import { tagFilter } from './tag-filter.js'
import { testPath } from './test-path.js'
import { validateFoundations, type FoundationsOption } from './validate-foundations.js'

export interface DescribeMeReporterOptions {
  /** Output directory, relative to the Vitest root. Default: `.describe-me` */
  outDir?: string
  /**
   * Which test files appear in the manifest: globs relative to the Vitest
   * root, matched with picomatch, dotfiles included. An empty list leaves every
   * file out of the manifest and warns. Default: every test file.
   */
  include?: string | string[]
  /**
   * Test files to leave out of the manifest, as globs like `include`. Wins over
   * `include`. Default: none.
   */
  exclude?: string | string[]
  /**
   * Which tests appear in the manifest: `'all'`, or only those tagged `docs`.
   * A test tagged `no-docs` never does. Default: `'all'`.
   */
  stories?: StoriesMode
  /**
   * HTML the viewer adds to the start of the `<head>` of every replayed frame,
   * like Storybook's `preview-head.html`. It never reaches the test page.
   * Project files it links are copied into the output directory. Default: none.
   */
  previewHead?: string
  /** Problems in the project's setup, filled by the plugin. Default: none. */
  setupWarnings?: string[]
  /**
   * The design-system foundations the reporter writes to `foundations.json`.
   * `theme` names a theme module relative to the root: `'src/theme.ts'` reads
   * its export `theme`, else `default`, and `'src/theme.ts#name'` reads `name`.
   * `false` switches them off. Default: on, without a theme module.
   */
  foundations?: false | { theme?: string }
}

type ManifestError = NonNullable<ManifestTest['errors']>[number]

function toPosix(moduleId: string): string {
  return moduleId.split(sep).join('/')
}

/**
 * Vitest's own module runner for project files, when this Vitest has one. A
 * script that calls the reporter directly passes only `config.root`.
 */
function importModuleOf(vitest: Vitest | undefined): ImportModule | undefined {
  let project: unknown

  try {
    project = vitest?.getRootProject()
  } catch {
    return undefined
  }

  if (typeof project !== 'object' || project === null) {
    return undefined
  }

  const { import: importFile } = project as { import?: unknown }

  if (typeof importFile !== 'function') {
    return undefined
  }

  return (file) => (importFile as (file: string) => Promise<unknown>).call(project, file)
}

function recordOf(tc: TestCase): TestRecord | undefined {
  return (tc.meta() as Record<string, unknown>)[META_KEY] as TestRecord | undefined
}

/** The test's tags for the manifest, where `undefined` leaves them out of the JSON. */
function tagsOf(tc: TestCase): string[] | undefined {
  // Vitest before 4.1 has no tags.
  const tags = tc.tags ?? []

  return tags.length > 0 ? tags : undefined
}

export default class DescribeMeReporter implements Reporter {
  private readonly outDirOption: string
  private readonly isRecordedFile: (fileName: string) => boolean
  private readonly isRecordedTags: (tags: readonly string[]) => boolean
  private readonly emptyInclude: boolean
  private readonly previewHead: string | undefined
  private readonly generator: ManifestGenerator | undefined
  private readonly setupWarnings: string[]
  private readonly foundations: FoundationsOption
  private root = process.cwd()
  private configFile: string | undefined
  private outDir = ''
  private paths!: ProjectPaths
  private snapshots!: SnapshotStore
  private assets!: AssetStore
  private styles!: StyleStore
  private fonts!: FontAudit
  private sheets!: RecordedSheets
  private vitest: Vitest | undefined
  private readonly tailwindModules = new Map<string, Promise<unknown>>()
  private modules = new Map<string, ManifestModule>()

  constructor(options: DescribeMeReporterOptions = {}) {
    this.outDirOption = options.outDir ?? '.describe-me'
    const include = compileInclude(options.include)
    this.isRecordedFile = fileFilter({ include, exclude: compileGlobs(options.exclude) })
    this.isRecordedTags = tagFilter(options.stories ?? 'all')
    this.emptyInclude = include !== null && include.length === 0

    // A blank head, such as an empty preview-head.html, is the same as none.
    this.previewHead = options.previewHead?.trim() ? options.previewHead : undefined
    this.generator = readGenerator()
    this.setupWarnings = options.setupWarnings ?? []
    // Here too, because the reporter also runs without the plugin.
    this.foundations = validateFoundations(options.foundations)
  }

  onInit(vitest: Vitest): void {
    this.root = vitest.config.root
    // A script that calls the reporter directly passes no Vite server, so there is no file to name.
    this.configFile = this.relativeConfigFile(vitest.vite?.config.configFile)
    this.outDir = resolve(this.root, this.outDirOption)
    this.paths = new ProjectPaths(this.root)
    this.snapshots = new SnapshotStore(this.outDir)
    this.assets = new AssetStore(this.outDir, this.root)
    this.styles = new StyleStore(this.outDir)
    this.fonts = new FontAudit(this.outDir)
    this.sheets = new RecordedSheets(this.outDir)
    this.vitest = vitest
    this.seedFromPreviousRun()

    if (this.previewHead !== undefined && /<script\b/i.test(this.previewHead)) {
      console.warn('describe-me: previewHead contains a <script>, which the viewer never runs.')
    }

    // Here and not in the constructor: the plugin builds the reporter in
    // `config()`, which also runs for a `vite build` that shares the config.
    if (this.emptyInclude) {
      console.warn(
        "describe-me: include is an empty list, so no test file is recorded. Leave include out to record every test file, or set exclude: '**' to record none without this warning.",
      )
    }
  }

  onTestRunStart(): void {
    this.assets.startRun()
  }

  /**
   * A filtered run (`vitest run Button.test.tsx`) must not wipe the other
   * modules from the manifest, so start from whatever the last run wrote.
   * Modules whose file is gone or no longer selected by `include` / `exclude`
   * are dropped, and so are tests that `stories` no longer selects and the
   * empty tests that 0.4 still wrote.
   */
  private seedFromPreviousRun(): void {
    const file = join(this.outDir, 'manifest.json')
    if (!existsSync(file)) {
      return
    }

    try {
      const previous = JSON.parse(readFileSync(file, 'utf8')) as Manifest
      for (const mod of previous.modules ?? []) {
        const tests = this.withStableIds(mod).filter(
          (test) => isRecordedTest(test) && this.isRecordedTags(test.tags ?? []),
        )

        if (
          tests.length > 0 &&
          this.isRecordedModule(mod.id) &&
          existsSync(resolve(this.root, mod.id))
        ) {
          this.modules.set(mod.id, { ...mod, tests })
        }
      }
    } catch {
      // corrupt or incompatible manifest: start fresh
    }
  }

  /**
   * Tests written before 0.5 carry Vitest's id. They get their stable id, and
   * the old one moves to `vitestId`. Occurrences are counted over the module's
   * full list, as the run that wrote it saw them.
   */
  private withStableIds(mod: ManifestModule): ManifestTest[] {
    const ids = stableTestIds(toPosix(mod.id), mod.tests)

    return mod.tests.map((test, i) => {
      if (test.vitestId !== undefined) {
        return test
      }

      return { ...test, id: ids[i], vitestId: test.id }
    })
  }

  /**
   * A test skipped in this run keeps its previous entry with its current tags,
   * so a filtered run does not erase documentation.
   */
  onTestModuleEnd(module: TestModule): void {
    const id = relative(this.root, module.moduleId)

    if (!this.isRecordedModule(id)) {
      this.modules.delete(id)
      return
    }

    const previous = this.modules.get(id)
    const tests: ManifestTest[] = []

    // Over every test, skipped ones included, so an id does not depend on
    // which tests recorded frames or on `-t` and `.only`.
    const cases = Array.from(module.children.allTests())
    const stableIds = stableTestIds(
      toPosix(id),
      cases.map((tc) => ({ path: testPath(tc), name: tc.name })),
    )

    for (const [i, tc] of cases.entries()) {
      const test = this.manifestTestOf(tc, stableIds[i], previous)

      if (test) {
        tests.push(test)
      }
    }

    if (tests.length === 0) {
      this.modules.delete(id)
      return
    }

    this.modules.set(id, { id, tests })
  }

  async onTestRunEnd(): Promise<void> {
    const modules = Array.from(this.modules.values()).sort((left, right) =>
      left.id.localeCompare(right.id),
    )

    const components = await collectComponentDocsSafely(
      this.root,
      componentEntries(modules, this.root),
    )

    // Before `missing()`, so the files the head links that do not exist are listed too.
    const head =
      this.previewHead === undefined ? undefined : this.assets.rewriteHead(this.previewHead)

    // Only what this run found: a filtered run does not know which of the
    // previous run's missing assets belonged to the modules it skipped.
    const assetsMissing = this.assets.missing()

    const manifest: Manifest = {
      version: 1,
      generator: this.generator,
      generatedAt: new Date().toISOString(),
      root: this.root,
      // Always this run's, never the previous manifest's. `undefined` leaves it out of the JSON.
      configFile: this.configFile,
      modules,
      components,
      assetsMissing,
    }

    if (head !== undefined) {
      manifest.head = head
    }

    const snapshotFiles = manifest.modules.flatMap((mod) =>
      mod.tests.flatMap((test) => test.frames.map((frame) => frame.snapshot)),
    )

    this.snapshots.collectGarbage(snapshotFiles)
    const styleFiles = this.styles.collectGarbage(snapshotFiles)
    this.assets.collectGarbage([...snapshotFiles, ...styleFiles], head === undefined ? [] : [head])
    this.auditFonts(manifest)

    // Never seeded from the last run: the plugin checks the setup on every start.
    if (this.setupWarnings.length > 0) {
      manifest.setupWarnings = this.setupWarnings.map((warning) => this.paths.inText(warning))
    }

    // After the garbage collection, so every snapshot and chunk it reads exists.
    // Before the manifest, because the dev viewer reloads on a manifest change
    // and must then find the matching foundations.
    const foundations = await this.writeFoundations([...new Set(snapshotFiles)])

    if (foundations !== undefined) {
      manifest.foundations = foundations
    }

    writeFileSync(join(this.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    printDiagnostics(manifest)
  }

  /**
   * Write `foundations.json` from every kept snapshot, those of skipped tests
   * included, and return what the manifest says about it. A run without
   * tokens and problems, or with the option off, removes a stale file.
   */
  private async writeFoundations(
    snapshotFiles: string[],
  ): Promise<ManifestFoundations | undefined> {
    const file = join(this.outDir, 'foundations.json')

    if (!this.foundations.enabled) {
      rmSync(file, { force: true })
      return undefined
    }

    let collected: CollectedFoundations

    // A diagnostic must never break the manifest.
    try {
      collected = await collectFoundations({
        root: this.root,
        snapshotFiles,
        option: this.foundations,
        importModule: importModuleOf(this.vitest),
        paths: this.paths,
        sheets: this.sheets,
        tailwindModules: this.tailwindModules,
      })
    } catch (error) {
      collected = this.failedFoundations(error)
    }

    const { foundations, summary } = collected

    if (summary.tokens === 0 && summary.errors === undefined) {
      rmSync(file, { force: true })
      return undefined
    }

    writeFileSync(file, JSON.stringify(foundations, null, 2))

    return summary
  }

  private failedFoundations(error: unknown): CollectedFoundations {
    const errors = [this.paths.inText(`foundations: collecting failed: ${firstLineOf(error)}`)]

    return {
      foundations: {
        version: 1,
        systems: [],
        tokenSheets: [],
        fontSheets: [],
        cssSources: [],
        tokens: [],
        errors,
        duration: 0,
      },
      summary: { systems: [], tokens: 0, errors },
    }
  }

  /** A diagnostic must never break the manifest, so a failing audit writes empty lists. */
  private auditFonts(manifest: Manifest): void {
    try {
      const { fontsMissing, remoteStylesheets } = this.fonts.audit(manifest)
      manifest.fontsMissing = fontsMissing
      manifest.remoteStylesheets = remoteStylesheets
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`describe-me: the font audit failed: ${message}`)
      manifest.fontsMissing = []
      manifest.remoteStylesheets = []
    }
  }

  /** The config file of the run, relative to the root, so the live preview loads the same one. */
  private relativeConfigFile(configFile: string | undefined): string | undefined {
    return configFile === undefined ? undefined : toPosix(relative(this.root, configFile))
  }

  /** Module ids use the platform's separators. Globs expect posix ones. */
  private isRecordedModule(id: string): boolean {
    return this.isRecordedFile(toPosix(id))
  }

  /** Decided before any snapshot is written, so a dropped test writes no file. */
  private manifestTestOf(
    tc: TestCase,
    stableId: string,
    previous: ManifestModule | undefined,
  ): ManifestTest | undefined {
    // Before the skipped branch, so a test tagged out since the last run does
    // not survive a filtered run on its old frames. Vitest before 4.1 has no tags.
    if (!this.isRecordedTags(tc.tags ?? [])) {
      return undefined
    }

    const record = recordOf(tc)

    if (record && isRecordedTest(record)) {
      return this.toManifestTest(tc, stableId, record)
    }

    if (tc.result().state !== 'skipped') {
      return undefined
    }

    const kept = previous?.tests.find((test) => test.id === stableId && isRecordedTest(test))

    if (kept === undefined) {
      return undefined
    }

    // Tags belong to the test, not to the run, and Vitest knows them for a
    // skipped test too. The viewer shows and filters by them.
    return { ...kept, tags: tagsOf(tc) }
  }

  private toManifestTest(tc: TestCase, stableId: string, record: TestRecord): ManifestTest {
    const result = tc.result()
    const frames: ManifestFrame[] = record.frames.map((frame) => ({
      id: frame.id,
      kind: frame.kind,
      label: frame.label,
      at: frame.at,
      meta: frame.meta,
      snapshot: this.writeSnapshot(frame.snapshot, record.origin),
    }))

    return {
      id: stableId,
      vitestId: tc.id,
      name: tc.name,
      path: testPath(tc),
      fullName: tc.fullName,
      tags: tagsOf(tc),
      state: (result.state as TestState) ?? 'pending',
      duration: tc.diagnostic()?.duration,
      errors: result.errors?.map((error) => this.errorOf(error)),
      component: record.component,
      frames,
    }
  }

  /** A test error with its files named from the root. A missing stack stays missing. */
  private errorOf(error: ManifestError): ManifestError {
    const { message, stack } = error

    return {
      // Vitest passes on a thrown object that has no message as it is.
      message: typeof message === 'string' ? this.paths.inText(message) : message,
      stack: typeof stack === 'string' ? this.paths.inText(stack) : stack,
    }
  }

  /**
   * Store one frame's DOM, with asset URLs pointing into the asset store and
   * long stylesheets moved to the style store. Assets go first, so stored CSS
   * carries asset URLs too. Cleaning goes last, so it parses the snapshot
   * without its long sheets, and the stored name is the hash of the cleaned text.
   */
  private writeSnapshot(snapshot: unknown, origin: string | undefined): string {
    // A mixed install, where an older core created the global recorder, still hands over objects.
    const json = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot)

    return this.snapshots.write(
      cleanSnapshot(this.styles.extract(this.assets.rewrite(json, origin)), this.paths),
    )
  }
}
