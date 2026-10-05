import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './repo-root.mjs'

/** The HTML of a page in `docs/`, by file name, or `null` when there is no such file. */
export function readPage(file) {
  const path = join(repoRoot, 'docs', file)
  if (!existsSync(path)) {
    return null
  }

  return readFileSync(path, 'utf8')
}
