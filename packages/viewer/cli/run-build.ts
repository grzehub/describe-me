import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { buildLivePreview } from './build-live-preview.js'
import { changesJson } from './changes-json.js'
import type { ChangesReport } from './changes-report.js'
import { diffRuns } from './diff-runs.js'
import { fontCacheDir } from './font-cache-dir.js'
import { printVendorReport } from './print-vendor-report.js'
import { readRun } from './read-run.js'
import { vendorFonts } from './vendor-fonts.js'
import { viewerRoot } from './viewer-root.js'
import { writeProjectId } from './write-project-id.js'

/** What `build` does besides the Vite build. */
export interface RunBuildOptions {
  /** Download web fonts from known font hosts into the site. */
  vendorFonts: boolean
  /** Build the live preview into the site as `__live/`. */
  live: boolean
  /** The project root of the live preview. Default: the manifest's `root` and `configFile`. */
  root?: string
  /** The data directory of a base run, which goes into the site as `__base/` with `changes.json`. */
  base?: string
}

/** The report of `base` against `data`, and the current run's `root`. Throws as `diff` does. */
interface Comparison {
  report: ChangesReport
  root: string | undefined
}

function compare(base: string, data: string): Comparison {
  // The base first, as `diff` reads them, so the same run gets the blame.
  const baseRun = readRun(base)
  const head = readRun(data)
  const report = diffRuns(baseRun, head)
  const root = head.manifest.root

  return { report, root: typeof root === 'string' ? root : undefined }
}

/** Vendor the fonts of one directory of the site. It never fails the build. */
async function vendorInto(siteDir: string, name: string, cacheDir: string): Promise<void> {
  try {
    printVendorReport(await vendorFonts(siteDir, { cacheDir }), name)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      `describe-me: font vendoring stopped (${message}). Fonts keep loading from the network.`,
    )
  }
}

/**
 * Produce a self-contained static site: the viewer plus the data directory
 * under `__data/`, whose manifest names the project by an id, and with `live`
 * the live preview under `__live/`. A live build that fails stops the command.
 * With `base`, the base run goes under `__base/`, named by the same id, and
 * the report of `describe-me diff` into `__data/changes.json`. A manifest or
 * snapshot that cannot be read then stops the command before `out` is
 * touched. Font vendoring works on the copies and never fails the build.
 */
export async function runBuild(data: string, out: string, options: RunBuildOptions): Promise<void> {
  const comparison = options.base === undefined ? undefined : compare(options.base, data)

  process.env.DESCRIBE_ME_DIR = resolve(data)

  // Only the flag decides, never a variable left in the shell.
  if (options.base === undefined) {
    delete process.env.DESCRIBE_ME_BASE
  } else {
    process.env.DESCRIBE_ME_BASE = resolve(options.base)
  }

  const root = viewerRoot()
  const site = resolve(out)

  await build({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    build: { outDir: site, emptyOutDir: true },
  })

  // The live preview reads the source data, which keeps the absolute root.
  writeProjectId(join(site, '__data'))

  if (comparison !== undefined) {
    writeProjectId(join(site, '__base'), comparison.root)
    mkdirSync(join(site, '__data'), { recursive: true })
    writeFileSync(join(site, '__data', 'changes.json'), changesJson(comparison.report))
  }

  // After the viewer, whose build empties `out` and so removes an old `__live/` and `__live.json`.
  if (options.live) {
    await buildLivePreview(data, out, options.root)
  }

  if (!options.vendorFonts) {
    return
  }

  const cacheDir = fontCacheDir(resolve(data))

  // The Vite plugin has already warned when there was no data to copy.
  for (const name of ['__data', '__base']) {
    if (existsSync(join(site, name))) {
      await vendorInto(join(site, name), name, cacheDir)
    }
  }
}
