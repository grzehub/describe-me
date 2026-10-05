/**
 * Node-side Vitest reporter. Collects frames from task.meta and writes
 * `.describe-me/`: `manifest.json`, `snapshots/`, `styles/` and `assets/`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node'
import {
  META_KEY,
  type Manifest,
  type ManifestFrame,
  type ManifestGenerator,
  type ManifestModule,
  type ManifestTest,
  type TestRecord,
  type TestState,
} from '@describe-me/core/types'
import { AssetStore } from './asset-store.js'
import { collectComponentDocsSafely } from './collect-component-docs-safely.js'
import { compileGlobs } from './compile-globs.js'
import { compileInclude } from './compile-include.js'
import { componentEntries } from './component-entries.js'
import { fileFilter } from './file-filter.js'
import { FontAudit } from './font-audit.js'
import { isRecordedTest } from './is-recorded-test.js'
import { printDiagnostics } from './print-diagnostics.js'
import { readGenerator } from './read-generator.js'
import { SnapshotStore } from './snapshot-store.js'
import { stableTestIds } from './stable-test-ids.js'
import { StyleStore } from './style-store.js'
import { testPath } from './test-path.js'

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
   * HTML the viewer adds to the start of the `<head>` of every replayed frame,
   * like Storybook's `preview-head.html`. It never reaches the test page.
   * Project files it links are copied into the output directory. Default: none.
   */
  previewHead?: string
  /** Problems in the project's setup, filled by the plugin. Default: none. */
  setupWarnings?: string[]
}

function toPosix(moduleId: string): string {
  return moduleId.split(sep).join('/')
}

function recordOf(tc: TestCase): TestRecord | undefined {
  return (tc.meta() as Record<string, unknown>)[META_KEY] as TestRecord | undefined
}

export default class DescribeMeReporter implements Reporter {
  private readonly outDirOption: string
  private readonly isRecordedFile: (fileName: string) => boolean
  private readonly emptyInclude: boolean
  private readonly previewHead: string | undefined
  private readonly generator: ManifestGenerator | undefined
  private readonly setupWarnings: string[]
  private root = process.cwd()
  private outDir = ''
  private snapshots!: SnapshotStore
  private assets!: AssetStore
  private styles!: StyleStore
  private fonts!: FontAudit
  private modules = new Map<string, ManifestModule>()

  constructor(options: DescribeMeReporterOptions = {}) {
    this.outDirOption = options.outDir ?? '.describe-me'
    const include = compileInclude(options.include)
    this.isRecordedFile = fileFilter({ include, exclude: compileGlobs(options.exclude) })
    this.emptyInclude = include !== null && include.length === 0

    // A blank head, such as an empty preview-head.html, is the same as none.
    this.previewHead = options.previewHead?.trim() ? options.previewHead : undefined
    this.generator = readGenerator()
    this.setupWarnings = options.setupWarnings ?? []
  }

  onInit(vitest: Vitest): void {
    this.root = vitest.config.root
    this.outDir = resolve(this.root, this.outDirOption)
    this.snapshots = new SnapshotStore(this.outDir)
    this.assets = new AssetStore(this.outDir, this.root)
    this.styles = new StyleStore(this.outDir)
    this.fonts = new FontAudit(this.outDir)
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
   * are dropped, and so are the empty tests that 0.4 still wrote.
   */
  private seedFromPreviousRun(): void {
    const file = join(this.outDir, 'manifest.json')
    if (!existsSync(file)) {
      return
    }

    try {
      const previous = JSON.parse(readFileSync(file, 'utf8')) as Manifest
      for (const mod of previous.modules ?? []) {
        const tests = this.withStableIds(mod).filter((test) => isRecordedTest(test))

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
   * A test skipped in this run keeps its previous entry, so a filtered run does
   * not erase documentation.
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
      manifest.setupWarnings = this.setupWarnings
    }

    writeFileSync(join(this.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    printDiagnostics(manifest)
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
    const record = recordOf(tc)

    if (record && isRecordedTest(record)) {
      return this.toManifestTest(tc, stableId, record)
    }

    if (tc.result().state !== 'skipped') {
      return undefined
    }

    return previous?.tests.find((test) => test.id === stableId && isRecordedTest(test))
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
      state: (result.state as TestState) ?? 'pending',
      duration: tc.diagnostic()?.duration,
      errors: result.errors?.map((error) => ({ message: error.message, stack: error.stack })),
      component: record.component,
      frames,
    }
  }

  /**
   * Store one frame's DOM, with asset URLs pointing into the asset store and
   * long stylesheets moved to the style store. Assets go first, so stored CSS
   * carries asset URLs too.
   */
  private writeSnapshot(snapshot: unknown, origin: string | undefined): string {
    // A mixed install, where an older core created the global recorder, still hands over objects.
    const json = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot)

    return this.snapshots.write(this.styles.extract(this.assets.rewrite(json, origin)))
  }
}
