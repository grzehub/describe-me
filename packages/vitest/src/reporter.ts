/**
 * Node-side Vitest reporter. Collects frames from task.meta and writes
 * `.describe-me/`: `manifest.json`, one file per distinct snapshot in
 * `snapshots/`, the stylesheet chunks they refer to in `styles/` and the
 * project files they point at in `assets/`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node'
import {
  META_KEY,
  type Manifest,
  type ManifestFrame,
  type ManifestModule,
  type ManifestTest,
  type TestRecord,
  type TestState,
} from '@describe-me/core/types'
import { AssetStore } from './asset-store.js'
import { collectComponentDocsSafely } from './collect-component-docs-safely.js'
import { compileGlobs } from './compile-globs.js'
import { componentEntries } from './component-entries.js'
import { fileFilter } from './file-filter.js'
import { isRecordedTest } from './is-recorded-test.js'
import { printDiagnostics } from './print-diagnostics.js'
import { SnapshotStore } from './snapshot-store.js'
import { StyleStore } from './style-store.js'
import { testPath } from './test-path.js'

export interface DescribeMeReporterOptions {
  /** Output directory, relative to the Vitest root. Default: `.describe-me` */
  outDir?: string
  /**
   * Which test files appear in the manifest: globs relative to the Vitest
   * root, matched with picomatch, dotfiles included. Default: every test file.
   */
  include?: string | string[]
  /**
   * Test files to leave out of the manifest, as globs like `include`. Wins over
   * `include`. Default: none.
   */
  exclude?: string | string[]
}

function recordOf(tc: TestCase): TestRecord | undefined {
  return (tc.meta() as Record<string, unknown>)[META_KEY] as TestRecord | undefined
}

export default class DescribeMeReporter implements Reporter {
  private readonly outDirOption: string
  private readonly isRecordedFile: (fileName: string) => boolean
  private root = process.cwd()
  private outDir = ''
  private snapshots!: SnapshotStore
  private assets!: AssetStore
  private styles!: StyleStore
  private modules = new Map<string, ManifestModule>()

  constructor(options: DescribeMeReporterOptions = {}) {
    this.outDirOption = options.outDir ?? '.describe-me'
    this.isRecordedFile = fileFilter({
      include: compileGlobs(options.include),
      exclude: compileGlobs(options.exclude),
    })
  }

  onInit(vitest: Vitest): void {
    this.root = vitest.config.root
    this.outDir = resolve(this.root, this.outDirOption)
    this.snapshots = new SnapshotStore(this.outDir)
    this.assets = new AssetStore(this.outDir, this.root)
    this.styles = new StyleStore(this.outDir)
    this.seedFromPreviousRun()
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
        const tests = mod.tests.filter((test) => isRecordedTest(test))

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

    for (const tc of module.children.allTests()) {
      const test = this.manifestTestOf(tc, previous)

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

    // Only what this run found: a filtered run does not know which of the
    // previous run's missing assets belonged to the modules it skipped.
    const assetsMissing = this.assets.missing()

    const manifest: Manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      root: this.root,
      modules,
      components,
      assetsMissing,
    }

    const snapshotFiles = manifest.modules.flatMap((mod) =>
      mod.tests.flatMap((test) => test.frames.map((frame) => frame.snapshot)),
    )

    this.snapshots.collectGarbage(snapshotFiles)
    const styleFiles = this.styles.collectGarbage(snapshotFiles)
    this.assets.collectGarbage([...snapshotFiles, ...styleFiles])
    writeFileSync(join(this.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    printDiagnostics(manifest)
  }

  /** Module ids use the platform's separators. Globs expect posix ones. */
  private isRecordedModule(id: string): boolean {
    return this.isRecordedFile(id.split(sep).join('/'))
  }

  /** Decided before any snapshot is written, so a dropped test writes no file. */
  private manifestTestOf(
    tc: TestCase,
    previous: ManifestModule | undefined,
  ): ManifestTest | undefined {
    const record = recordOf(tc)

    if (record && isRecordedTest(record)) {
      return this.toManifestTest(tc, record)
    }

    if (tc.result().state !== 'skipped') {
      return undefined
    }

    return previous?.tests.find(
      (test) => test.id === tc.id && test.fullName === tc.fullName && isRecordedTest(test),
    )
  }

  private toManifestTest(tc: TestCase, record: TestRecord): ManifestTest {
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
      id: tc.id,
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
   * Store one frame's DOM, with its project asset URLs pointing into the asset
   * store and its long stylesheets moved into the style store. Assets go first,
   * so the stored CSS already carries asset URLs.
   */
  private writeSnapshot(snapshot: unknown, origin: string | undefined): string {
    // A mixed install, where an older core created the global recorder, still hands over objects.
    const json = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot)

    return this.snapshots.write(this.styles.extract(this.assets.rewrite(json, origin)))
  }
}
