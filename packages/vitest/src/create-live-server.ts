import { relative, resolve } from 'node:path'
import type { Vite } from 'vitest/node'
import { checkLiveEnabled } from './check-live-enabled.js'
import { findLiveConfigFile } from './find-live-config-file.js'
import { freeLivePort } from './free-live-port.js'
import { importLiveVite } from './import-live-vite.js'
import { livePluginProtocol } from './live-plugin-protocol.js'
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
  const { plugins } = server.config
  const protocol = await closingOnError(server, () => livePluginProtocol(plugins, configName))

  await closingOnError(server, () => checkLiveEnabled(plugins, configName))

  await closingOnError(server, () => server.listen())

  const local = server.resolvedUrls?.local[0] ?? `http://localhost:${port}/`

  return {
    base: new URL('__describe-me/', local).href,
    protocol,
    close: () => server.close(),
  }
}
