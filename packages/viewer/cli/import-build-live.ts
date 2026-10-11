import { pathToFileURL } from 'node:url'
import { LIVE_CONSEQUENCES } from './live-consequences.js'
import { livePredates } from './live-predates.js'
import { resolveLiveEntry } from './resolve-live-entry.js'

/**
 * What the CLI passes to `buildLive()` from `@describe-me/vitest/live`.
 * Declared here, because `describe-me` does not depend on `@describe-me/vitest`.
 */
export interface LivePreviewBuildOptions {
  /** The project root. */
  root: string
  /** The Vitest config file, relative to `root`. Absent: the one Vitest picks there. */
  configFile?: string
  /** Where the live page goes. */
  outDir: string
  /** The module ids of the manifest. */
  testFiles: string[]
}

/** The part of a finished live build that the CLI uses. */
export interface LivePreviewBuild {
  /** The live protocol of the project's describeMe() plugin. */
  protocol: number
}

/** `buildLive()` as the CLI calls it. */
export type BuildLive = (options: LivePreviewBuildOptions) => Promise<LivePreviewBuild>

/**
 * `buildLive()` from the project's own `@describe-me/vitest/live`, so the
 * build runs the plugin the tests ran with. Throws the reason when the
 * project has none.
 */
export async function importBuildLive(root: string): Promise<BuildLive> {
  const entry = resolveLiveEntry(root, LIVE_CONSEQUENCES.build)
  const exported: unknown = await import(pathToFileURL(entry).href)
  const build =
    typeof exported === 'object' && exported !== null && 'buildLive' in exported
      ? exported.buildLive
      : undefined

  if (typeof build !== 'function') {
    throw livePredates(root, 'buildLive()', LIVE_CONSEQUENCES.build)
  }

  return build as BuildLive
}
