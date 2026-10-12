import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

/** A Vitest release, as far as describe-me needs to tell them apart. */
export interface VitestVersion {
  major: number
  minor: number
}

/**
 * The version of the `vitest` that the root resolves, or `null` when it cannot
 * be read. Vitest exports its `package.json`.
 */
export function readVitestVersion(root: string): VitestVersion | null {
  try {
    const file = createRequire(join(root, 'package.json')).resolve('vitest/package.json')
    const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown }
    const [major, minor] = typeof version === 'string' ? version.split('.').map(Number) : []

    if (!Number.isInteger(major) || major <= 0 || !Number.isInteger(minor)) {
      return null
    }

    return { major, minor }
  } catch {
    return null
  }
}
