import { readFileSync } from 'node:fs'
import type { ManifestGenerator } from '@describe-me/core/types'

/**
 * The name and version of this package, for the manifest's `generator`, or
 * `undefined` when its package.json cannot be read, so the manifest is still
 * written.
 */
export function readGenerator(): ManifestGenerator | undefined {
  try {
    // The compiled file sits in `dist/`, one level below the package root, and
    // `exports` does not list `./package.json`.
    const file = new URL('../package.json', import.meta.url)
    const { name, version } = JSON.parse(readFileSync(file, 'utf8')) as {
      name?: unknown
      version?: unknown
    }

    if (typeof name !== 'string' || typeof version !== 'string') {
      return undefined
    }

    return { name, version }
  } catch {
    return undefined
  }
}
