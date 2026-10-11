import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Vite } from 'vitest/node'
import { findLiveConfigFile } from './find-live-config-file.js'
import { importLiveVite } from './import-live-vite.js'
import { liveBuildPlugin } from './live-build-plugin.js'
import { liveProjectPlugins } from './live-project-plugins.js'
import { loadLiveConfig } from './load-live-config.js'

/** What `buildLive()` builds, and where it writes the page. */
export interface LiveBuildOptions {
  /** The project root. */
  root: string
  /** The Vitest config file, relative to `root` or absolute. Default: the one Vitest picks. */
  configFile?: string
  /** Where the live page goes, relative to the current directory or absolute. Emptied first. */
  outDir: string
  /** The test files the page can import: module ids of the manifest, paths relative to `root`. */
  testFiles: string[]
}

/** A finished live build. */
export interface LiveBuild {
  /** `api.live.protocol` of the project's describeMe() plugin. */
  protocol: number
}

function isInRoot(file: string, root: string): boolean {
  const fromRoot = relative(root, file)

  return fromRoot !== '' && fromRoot.split(sep)[0] !== '..' && !isAbsolute(fromRoot)
}

/** The test files with `/` separators, without those that are not under the root, which it names once. */
function liveTestFiles(testFiles: string[], root: string): string[] {
  const kept = new Set<string>()
  const missing: string[] = []

  for (const file of testFiles.map((testFile) => testFile.replaceAll('\\', '/'))) {
    const path = resolve(root, file)

    if (isInRoot(path, root) && existsSync(path)) {
      kept.add(file)
    } else {
      missing.push(file)
    }
  }

  if (missing.length > 0) {
    console.warn(
      `describe-me: the live build leaves out test files that are not in ${root}: ${missing.join(', ')}`,
    )
  }

  return [...kept]
}

function liveBuildOptions(viteVersion: string, root: string, outDir: string): Vite.BuildOptions {
  // Vite 8 does not resolve a relative input against the root.
  const bundlerOptions = { input: join(root, 'live.html'), shimMissingExports: true }
  // Vite 8 bundles with Rolldown and older majors with Rollup, each under its own key.
  const bundler =
    Number.parseInt(viteVersion, 10) >= 8
      ? { rolldownOptions: bundlerOptions }
      : { rollupOptions: bundlerOptions }

  return {
    outDir: resolve(outDir),
    // Vite empties an outDir outside the root only when asked.
    emptyOutDir: true,
    // Suite and test names come from `fn.name`, as in Vitest. A minifier would rename
    // `describe(Button, …)` and `%s` rows of functions, so the page would not find tests that
    // dev mounts. Dev allows top-level await, which Vite 6's default target rejects.
    minify: false,
    target: 'esnext',
    // Unminified, React's development build alone is above Vite's default limit.
    chunkSizeWarningLimit: 10_000,
    ...bundler,
  }
}

/** Runs `build` with `NODE_ENV=development`, as on the dev server, and puts back what was there. */
async function inDevelopment<T>(build: () => Promise<T>): Promise<T> {
  const previous = process.env.NODE_ENV

  process.env.NODE_ENV = 'development'

  try {
    return await build()
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previous
    }
  }
}

/**
 * Builds the live preview into `outDir` as static files: `live.html`, the
 * setup files and a lazy import of each test file, with a relative base, so
 * it works under any path of a static host. It loads the project's config
 * the way `createLiveServer()` does, with the project's own Vite, and builds
 * the page the dev server serves. When the project's describeMe() has
 * `live: false`, it writes nothing and rejects with an error whose `code` is
 * `DESCRIBE_ME_LIVE_OFF`.
 */
export async function buildLive(options: LiveBuildOptions): Promise<LiveBuild> {
  // Vite 8 takes the real path of the root, and the page must lie under it to land in outDir.
  const root = realpathSync(resolve(options.root))
  const configFile =
    options.configFile === undefined ? findLiveConfigFile(root) : resolve(root, options.configFile)

  const testFiles = liveTestFiles(options.testFiles, root)
  const vite = await importLiveVite(root)
  const loaded = await loadLiveConfig(vite, configFile, root)
  const configName = relative(root, configFile) || configFile
  let protocol = 0

  const config: Vite.InlineConfig = vite.mergeConfig(loaded.config, {
    root,
    mode: 'test',
    base: './',
    logLevel: 'warn',
    clearScreen: false,
  })

  // Dev never reads the project's build section, nor runs its build-only plugins.
  config.build = liveBuildOptions(vite.version, root, options.outDir)
  config.plugins = [
    ...(await liveProjectPlugins(loaded.config.plugins)),
    liveBuildPlugin({
      configName,
      testFiles,
      onProtocol: (value) => {
        protocol = value
      },
    }),
  ]

  await inDevelopment(() => vite.build({ ...config, configFile: false }))

  return { protocol }
}
