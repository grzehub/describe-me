import type { Vite } from 'vitest/node'
import { LIVE_ENV } from './live-env.js'

type LoadedConfig = NonNullable<Awaited<ReturnType<typeof Vite.loadConfigFromFile>>>

/**
 * Loads the project's config the way Vitest serves it, with `describeMe()`
 * in live mode. The flag is set only while the config file runs, so nothing
 * else in this process sees it.
 */
export async function loadLiveConfig(
  vite: typeof Vite,
  configFile: string,
  root: string,
): Promise<LoadedConfig> {
  const previous = process.env[LIVE_ENV]

  process.env[LIVE_ENV] = '1'

  try {
    const loaded = await vite.loadConfigFromFile(
      { command: 'serve', mode: 'test', isSsrBuild: false, isPreview: false },
      configFile,
      root,
    )

    if (loaded === null) {
      throw new Error(`describe-me: cannot load ${configFile}`)
    }

    return loaded
  } finally {
    if (previous === undefined) {
      delete process.env[LIVE_ENV]
    } else {
      process.env[LIVE_ENV] = previous
    }
  }
}
