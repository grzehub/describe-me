import { existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

/**
 * Where downloaded fonts are cached: `node_modules/.cache/describe-me/fonts`
 * in the nearest `node_modules` at or above the source data directory, as
 * other build tools do. Without one it is a directory in the system temp dir.
 */
export function fontCacheDir(sourceDataDir: string): string {
  let dir = sourceDataDir

  while (true) {
    const nodeModules = join(dir, 'node_modules')
    if (isDirectory(nodeModules)) {
      return join(nodeModules, '.cache', 'describe-me', 'fonts')
    }

    const parent = dirname(dir)
    if (parent === dir) {
      return join(tmpdir(), 'describe-me-fonts')
    }

    dir = parent
  }
}
