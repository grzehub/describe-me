import type { Vite } from 'vitest/node'

/** The code of the error for a project whose describeMe() has `live: false`. */
const LIVE_OFF = 'DESCRIBE_ME_LIVE_OFF'

/** Throws with the code `DESCRIBE_ME_LIVE_OFF` when the project's describeMe() has `live: false`. */
export function checkLiveEnabled(plugins: readonly Vite.Plugin[], configName: string): void {
  const plugin = plugins.find((candidate) => candidate.name === 'describe-me')

  if (plugin?.api?.live?.enabled !== false) {
    return
  }

  throw Object.assign(
    new Error(`describe-me: live: false in ${configName} switches the live preview off`),
    { code: LIVE_OFF },
  )
}
