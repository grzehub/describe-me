import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { fontCacheDir } from './font-cache-dir.js'
import { printVendorReport } from './print-vendor-report.js'
import { vendorFonts } from './vendor-fonts.js'
import { viewerRoot } from './viewer-root.js'

/** What `build` does besides the Vite build. */
export interface RunBuildOptions {
  /** Download web fonts from known font hosts into the site. */
  vendorFonts: boolean
}

/**
 * Produce a self-contained static site: the viewer plus the data directory
 * under `__data/`. Font vendoring works on that copy and never fails the build.
 */
export async function runBuild(data: string, out: string, options: RunBuildOptions): Promise<void> {
  process.env.DESCRIBE_ME_DIR = resolve(data)

  const root = viewerRoot()

  await build({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    build: { outDir: resolve(out), emptyOutDir: true },
  })

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
