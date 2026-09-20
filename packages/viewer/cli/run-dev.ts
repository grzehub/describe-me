import { resolve } from 'node:path'
import { createServer } from 'vite'
import { viewerRoot } from './viewer-root.js'

/** Start the viewer against a data directory, with live updates as the reporter rewrites it. */
export async function runDev(data: string, port: number): Promise<void> {
  process.env.DESCRIBE_ME_DIR = resolve(data)

  const root = viewerRoot()
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    server: { port },
  })

  await server.listen()
  server.printUrls()
}
