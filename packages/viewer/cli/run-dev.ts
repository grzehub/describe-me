import { resolve } from 'node:path'
import { createServer } from 'vite'
import type { LivePreviewInfo } from './live-preview-info.js'
import { livePreviewEndpoint } from './live-preview-endpoint.js'
import { LIVE_PATH, livePreviewProxy } from './live-preview-proxy.js'
import { startLivePreview } from './start-live-preview.js'
import { viewerRoot } from './viewer-root.js'

/** What `dev` starts besides the viewer. */
export interface RunDevOptions {
  /** Start the live preview next to the viewer. */
  live: boolean
  /** The project root of the live preview. Default: the manifest's `root` and `configFile`. */
  root?: string
}

/**
 * Start the viewer against a data directory, refreshed as the reporter
 * rewrites it, then the live preview, which the viewer's server serves under
 * `/__describe-me/`. The viewer never waits for the preview, and a preview
 * that fails to start leaves the viewer running without Live.
 */
export async function runDev(data: string, port: number, options: RunDevOptions): Promise<void> {
  process.env.DESCRIBE_ME_DIR = resolve(data)

  let info: LivePreviewInfo = options.live ? { status: 'starting' } : { status: 'off' }
  // Set once the live server is up; the proxy reads it on every request under its path.
  const live: { origin?: string } = {}
  const viewer = viewerRoot()
  const server = await createServer({
    root: viewer,
    configFile: resolve(viewer, 'vite.config.ts'),
    server: { port },
    plugins: [livePreviewEndpoint(() => info), livePreviewProxy(() => live.origin)],
  })

  await server.listen()
  server.printUrls()

  if (!options.live) {
    return
  }

  const started = await startLivePreview(data, options.root)

  // Through the viewer's port when the live server can be proxied, else at its own address.
  live.origin = started.origin
  info =
    started.origin === undefined || started.info.status !== 'ready'
      ? started.info
      : { status: 'ready', base: LIVE_PATH.slice(1) }

  if (info.status === 'ready') {
    const local = server.resolvedUrls?.local[0] ?? `http://localhost:${port}/`

    process.stdout.write(`  ➜  Live preview: ${new URL(info.base ?? LIVE_PATH, local).href}\n`)
  } else if (info.status === 'off') {
    process.stdout.write(
      "describe-me: the project's config sets live: false, so the viewer runs without Live.\n",
    )
  } else {
    process.stderr.write(`describe-me: ${info.error}\n`)
  }
}
