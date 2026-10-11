import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { codeOf } from './code-of.js'
import { livePredates } from './live-predates.js'

function notFound(root: string, consequence: string): Error {
  return new Error(
    `cannot find @describe-me/vitest from ${root}, ${consequence}. Pass --root with the project directory.`,
  )
}

/** Whether `node_modules/@describe-me/vitest` is in `root` or a directory above it. */
function isInstalledFrom(root: string): boolean {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', '@describe-me', 'vitest', 'package.json'))) {
      return true
    }

    if (dirname(dir) === dir) {
      return false
    }
  }
}

/**
 * The file `@describe-me/vitest/live` resolves to from the project root.
 * Throws the reason, followed by `consequence`, when the project has none.
 */
export function resolveLiveEntry(root: string, consequence: string): string {
  // The bin shims of package managers put their own store on NODE_PATH, which
  // `resolve()` searches too. Only the project's own node_modules count.
  if (!isInstalledFrom(root)) {
    throw notFound(root, consequence)
  }

  try {
    return createRequire(join(root, 'package.json')).resolve('@describe-me/vitest/live')
  } catch (error) {
    if (codeOf(error) === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      throw livePredates(root, 'the live preview', consequence)
    }

    if (codeOf(error) === 'MODULE_NOT_FOUND') {
      throw notFound(root, consequence)
    }

    throw error
  }
}
