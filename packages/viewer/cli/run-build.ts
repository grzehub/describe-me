import { resolve } from 'node:path'
import { build } from 'vite'
import { viewerRoot } from './viewer-root.js'

/** Produce a self-contained static site: the viewer plus the data directory under `__data/`. */
export async function runBuild(data: string, out: string): Promise<void> {
  process.env.DESCRIBE_ME_DIR = resolve(data)

  const root = viewerRoot()

  await build({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    build: { outDir: resolve(out), emptyOutDir: true },
  })
}
