import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ViteDevServer } from 'vite'
import { createServer } from 'vite'
import { viewerRoot } from './viewer-root.js'

/** The viewer's dev server, which serves `frame.html` with both runs. */
export interface FrameServer {
  /** Such as `http://localhost:51234`. */
  origin: string
  /** Closes the server and removes its dependency cache. */
  close(): Promise<void>
}

async function listen(server: ViteDevServer): Promise<string> {
  await server.listen()

  const local = server.resolvedUrls?.local[0]

  if (local === undefined) {
    throw new Error('the frame server started without an address')
  }

  return new URL(local).origin
}

/**
 * Start the viewer on a Vite dev server for `diff --shots`, with `data` under
 * `/__data` and `base` under `/__base`. Vite's dependency cache goes into a
 * temp directory of its own, so the viewer package keeps no `.vite` from it.
 */
export async function startFrameServer(data: string, base: string): Promise<FrameServer> {
  process.env.DESCRIBE_ME_DIR = resolve(data)
  process.env.DESCRIBE_ME_BASE = resolve(base)

  const cacheDir = mkdtempSync(join(tmpdir(), 'describe-me-shots-'))
  const removeCache = (): void => rmSync(cacheDir, { recursive: true, force: true })
  const viewer = viewerRoot()
  let server: ViteDevServer

  try {
    // Port 0 takes a free one, because a running `describe-me dev` may hold 6006.
    server = await createServer({
      root: viewer,
      configFile: resolve(viewer, 'vite.config.ts'),
      cacheDir,
      logLevel: 'error',
      clearScreen: false,
      server: { port: 0, strictPort: true, open: false },
    })
  } catch (error) {
    removeCache()
    throw error
  }

  const close = async (): Promise<void> => {
    try {
      await server.close()
    } finally {
      removeCache()
    }
  }

  try {
    return { origin: await listen(server), close }
  } catch (error) {
    await close().catch(() => undefined)
    throw error
  }
}
