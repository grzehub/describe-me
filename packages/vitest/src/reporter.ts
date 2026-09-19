/**
 * Node-side Vitest reporter. Collects frames from task.meta and writes
 * `.describe-me/manifest.json` plus one file per snapshot.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
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
import { SnapshotStore } from './snapshot-store.js'
import { testPath } from './test-path.js'

export interface DescribeMeReporterOptions {
  /** Output directory, relative to the Vitest root. Default: `.describe-me` */
  outDir?: string
}

export default class DescribeMeReporter implements Reporter {
  private readonly outDirOption: string
  private root = process.cwd()
  private outDir = ''
  private snapshots!: SnapshotStore
  private modules = new Map<string, ManifestModule>()

  constructor(options: DescribeMeReporterOptions = {}) {
    this.outDirOption = options.outDir ?? '.describe-me'
  }

  onInit(vitest: Vitest): void {
    this.root = vitest.config.root
    this.outDir = resolve(this.root, this.outDirOption)
    this.snapshots = new SnapshotStore(this.outDir)
    this.seedFromPreviousRun()
  }

  /**
   * A filtered run (`vitest run Button.test.tsx`) must not wipe the other
   * modules from the manifest, so start from whatever the last run wrote.
   * Modules whose file no longer exists are dropped.
   */
  private seedFromPreviousRun(): void {
    const file = join(this.outDir, 'manifest.json')
    if (!existsSync(file)) {
      return
    }

    try {
      const previous = JSON.parse(readFileSync(file, 'utf8')) as Manifest
      for (const mod of previous.modules ?? []) {
        if (existsSync(resolve(this.root, mod.id))) {
          this.modules.set(mod.id, mod)
        }
      }
    } catch {
      // corrupt or incompatible manifest: start fresh
    }
  }

  onTestModuleEnd(module: TestModule): void {
    const id = relative(this.root, module.moduleId)
    const tests = Array.from(module.children.allTests()).map((tc) => this.toManifestTest(tc))
    this.modules.set(id, { id, tests })
  }

  onTestRunEnd(): void {
    const manifest: Manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      root: this.root,
      modules: Array.from(this.modules.values()).sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }

    this.snapshots.collectGarbage(
      manifest.modules.flatMap((mod) =>
        mod.tests.flatMap((test) => test.frames.map((frame) => frame.snapshot)),
      ),
    )

    writeFileSync(join(this.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  }

  private toManifestTest(tc: TestCase): ManifestTest {
    const record = (tc.meta() as Record<string, unknown>)[META_KEY] as TestRecord | undefined
    const result = tc.result()
    const frames: ManifestFrame[] = (record?.frames ?? []).map((frame) => ({
      id: frame.id,
      kind: frame.kind,
      label: frame.label,
      at: frame.at,
      meta: frame.meta,
      snapshot: this.snapshots.write(frame.snapshot),
    }))

    return {
      id: tc.id,
      name: tc.name,
      path: testPath(tc),
      fullName: tc.fullName,
      state: (result.state as TestState) ?? 'pending',
      duration: tc.diagnostic()?.duration,
      errors: result.errors?.map((error) => ({ message: error.message, stack: error.stack })),
      component: record?.component,
      frames,
    }
  }
}
