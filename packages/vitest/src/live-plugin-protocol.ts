import type { Vite } from 'vitest/node'
import { LIVE_PROTOCOL } from '@describe-me/core/types'

/** The live protocol of the project's describeMe() plugin, which must be this package's. */
export function livePluginProtocol(plugins: readonly Vite.Plugin[], configName: string): number {
  const plugin = plugins.find((candidate) => candidate.name === 'describe-me')

  if (plugin === undefined) {
    throw new Error(`describe-me: ${configName} has no describeMe() plugin`)
  }

  const protocol: unknown = plugin.api?.live?.protocol

  if (protocol !== LIVE_PROTOCOL) {
    throw new Error(
      `describe-me: all describe-me packages must be on the same version. The describeMe() plugin in ${configName} has live protocol ${String(protocol ?? 'none')}, expected ${LIVE_PROTOCOL}. Install @describe-me/core, @describe-me/react, @describe-me/vitest and describe-me at one version.`,
    )
  }

  return protocol
}
