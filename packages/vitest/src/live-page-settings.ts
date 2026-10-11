import type { ViteUserConfig } from 'vitest/config'
import { liveSetupFiles, type LiveSetupFile } from './live-setup-files.js'
import { readLiveBrowserNames } from './read-live-browser-names.js'
import { readLiveVitestMajor } from './read-live-vitest-major.js'
import { readLiveVitestNames } from './read-live-vitest-names.js'
import type { LiveOption } from './validate-live-option.js'

/** What the generated modules of the live page take from the project. */
export interface LivePageSettings {
  /** `test.globals`. */
  globals: boolean
  /** `test.testTimeout`, or Vitest's default for the environment. */
  testTimeout: number
  /** Every name the installed `vitest` exports. */
  vitestNames: string[]
  /** Every name the installed `vitest/browser` declares. */
  browserNames: string[]
  /** `live.setupFiles`, or else `test.setupFiles`, without describe-me's own. */
  setupFiles: LiveSetupFile[]
  /** The major version of the project's Vitest. */
  vitestMajor: number
}

function listOf(entries: string | string[] | undefined): string[] {
  if (entries === undefined) {
    return []
  }

  return Array.isArray(entries) ? entries : [entries]
}

/** Reads the settings of the live page from the project's config and its Vitest. */
export async function livePageSettings(
  userConfig: ViteUserConfig,
  root: string,
  live: LiveOption,
): Promise<LivePageSettings> {
  const test = userConfig.test
  // Vitest's own defaults.
  const defaultTimeout = test?.browser?.enabled ? 15_000 : 5_000

  return {
    globals: test?.globals === true,
    testTimeout: test?.testTimeout ?? defaultTimeout,
    vitestNames: await readLiveVitestNames(),
    browserNames: readLiveBrowserNames(root),
    setupFiles: liveSetupFiles(live.setupFiles ?? listOf(test?.setupFiles), root),
    vitestMajor: readLiveVitestMajor(root),
  }
}
