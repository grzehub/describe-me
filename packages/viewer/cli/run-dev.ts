import { resolve } from 'node:path'
import { createServer } from 'vite'
import type { LivePreviewInfo } from './live-preview-info.js'
import { livePreviewEndpoint } from './live-preview-endpoint.js'
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
 * rewrites it, then the live preview. The viewer never waits for the preview,
 * and a preview that fails to start leaves the viewer running without Live.
 */
export async function runDev(data: string, port: number, options: RunDevOptions): Promise<void> {
  process.env.DESCRIBE_ME_DIR = resolve(data)

  let info: LivePreviewInfo = options.live ? { status: 'starting' } : { status: 'off' }
  const viewer = viewerRoot()
  const server = await createServer({
    root: viewer,
    configFile: resolve(viewer, 'vite.config.ts'),
    server: { port },
    plugins: [livePreviewEndpoint(() => info)],
  })

  await server.listen()
  server.printUrls()

  if (!options.live) {
    return
  }

  info = await startLivePreview(data, options.root)

  if (info.status === 'ready') {
    process.stdout.write(`  ➜  Live preview: ${info.base}\n`)
  } else {
    process.stderr.write(`describe-me: ${info.error}\n`)
  }
}
