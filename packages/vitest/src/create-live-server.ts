import { relative, resolve } from 'node:path'
import type { Vite } from 'vitest/node'
import { LIVE_PROTOCOL } from '@describe-me/core/types'
import { findLiveConfigFile } from './find-live-config-file.js'
import { freeLivePort } from './free-live-port.js'
import { importLiveVite } from './import-live-vite.js'
import { loadLiveConfig } from './load-live-config.js'

/** Where the live preview finds the project. */
export interface LiveServerOptions {
  /** The project root. */
  root: string
  /**
   * The Vitest config file, relative to `root` or absolute. Default: the one
   * Vitest picks, the first `vitest.config.*`, then `vite.config.*`.
   */
  configFile?: string
  /** The port on localhost. Default: a free one. */
  port?: number
}

/** A running live preview server. */
export interface LiveServer {
  /** The URL the live page is under, such as `http://localhost:5173/__describe-me/`. */
  base: string
  /** `api.live.protocol` of the project's describeMe() plugin. */
  protocol: number
  /** Stops the server. */
  close(): Promise<void>
}

/** The code of the error for a project whose describeMe() has `live: false`. */
const LIVE_OFF = 'DESCRIBE_ME_LIVE_OFF'

type ServerPlugin = Vite.ViteDevServer['config']['plugins'][number]

function describeMePlugin(server: Vite.ViteDevServer): ServerPlugin | undefined {
  return server.config.plugins.find((candidate) => candidate.name === 'describe-me')
}

/** The live protocol of the project's describeMe() plugin, which must be this package's. */
function livePluginProtocol(server: Vite.ViteDevServer, configName: string): number {
  const plugin = describeMePlugin(server)

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

/** Throws with the code `DESCRIBE_ME_LIVE_OFF` when the project's describeMe() has `live: false`. */
function checkLiveEnabled(server: Vite.ViteDevServer, configName: string): void {
  if (describeMePlugin(server)?.api?.live?.enabled !== false) {
    return
  }

  throw Object.assign(
    new Error(`describe-me: live: false in ${configName} switches the live preview off`),
    { code: LIVE_OFF },
  )
}

/** Closes the server when `run` throws, so a failed start leaves no server behind. */
async function closingOnError<T>(
  server: Vite.ViteDevServer,
  run: () => T | Promise<T>,
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    await server.close()

    throw error
  }
}

/**
 * Starts the live preview: a second Vite dev server on the project's own
 * config, in mode `test` and on localhost only, whose page mounts one test
 * at a time. A change to the config file takes a new server. When the
 * project's describeMe() has `live: false`, it closes the server and rejects
 * with an error whose `code` is `DESCRIBE_ME_LIVE_OFF`.
 */
export async function createLiveServer(options: LiveServerOptions): Promise<LiveServer> {
  const root = resolve(options.root)
  const configFile =
    options.configFile === undefined ? findLiveConfigFile(root) : resolve(root, options.configFile)

  const vite = await importLiveVite(root)
  const loaded = await loadLiveConfig(vite, configFile, root)
  const port = options.port ?? (await freeLivePort())

  // With `configFile: false` Vite does not watch the config. An edit would
  // restart the server and run the config again without the flag, in recording mode.
  const server = await vite.createServer({
    ...vite.mergeConfig(loaded.config, {
      root,
      mode: 'test',
      base: '/',
      clearScreen: false,
      logLevel: 'warn',
      server: { host: 'localhost', port, strictPort: true, open: false },
    }),
    configFile: false,
  })

  const configName = relative(root, configFile) || configFile
  const protocol = await closingOnError(server, () => livePluginProtocol(server, configName))

  await closingOnError(server, () => checkLiveEnabled(server, configName))

  await closingOnError(server, () => server.listen())

  const local = server.resolvedUrls?.local[0] ?? `http://localhost:${port}/`

  return {
    base: new URL('__describe-me/', local).href,
    protocol,
    close: () => server.close(),
  }
}
