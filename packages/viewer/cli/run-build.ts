import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { buildLivePreview } from './build-live-preview.js'
import { fontCacheDir } from './font-cache-dir.js'
import { printVendorReport } from './print-vendor-report.js'
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
}

/**
 * Produce a self-contained static site: the viewer plus the data directory
 * under `__data/`, whose manifest names the project by an id, and with `live`
 * the live preview under `__live/`. A live build that fails stops the command.
 * Font vendoring works on the copy of the data and never fails the build.
 */
export async function runBuild(data: string, out: string, options: RunBuildOptions): Promise<void> {
  process.env.DESCRIBE_ME_DIR = resolve(data)

  const root = viewerRoot()

  await build({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    build: { outDir: resolve(out), emptyOutDir: true },
  })

  // The live preview reads the source data, which keeps the absolute root.
  writeProjectId(join(resolve(out), '__data'))

  // After the viewer, whose build empties `out` and so removes an old `__live/` and `__live.json`.
  if (options.live) {
    await buildLivePreview(data, out, options.root)
  }

  if (!options.vendorFonts) {
    return
  }

  // The Vite plugin has already warned when there was no data to copy.
  const dataDir = join(resolve(out), '__data')
  if (!existsSync(dataDir)) {
    return
  }

  try {
    printVendorReport(await vendorFonts(dataDir, { cacheDir: fontCacheDir(resolve(data)) }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      `describe-me: font vendoring stopped (${message}). Fonts keep loading from the network.`,
    )
  }
}
