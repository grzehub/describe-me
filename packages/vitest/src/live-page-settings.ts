import type { ViteUserConfig } from 'vitest/config'
import { readLiveBrowserNames } from './read-live-browser-names.js'
import { readLiveVitestNames } from './read-live-vitest-names.js'

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
}

/** Reads the settings of the live page from the project's config and its Vitest. */
export async function livePageSettings(
  userConfig: ViteUserConfig,
  root: string,
): Promise<LivePageSettings> {
  const test = userConfig.test
  // Vitest's own defaults.
  const defaultTimeout = test?.browser?.enabled ? 15_000 : 5_000

  return {
    globals: test?.globals === true,
    testTimeout: test?.testTimeout ?? defaultTimeout,
    vitestNames: await readLiveVitestNames(),
    browserNames: readLiveBrowserNames(root),
  }
}
