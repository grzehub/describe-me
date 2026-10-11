import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const DEFAULT_MAJOR = 5

/**
 * The major version of the `vitest` that the root resolves, whose rules the
 * live page names `each` and `for` rows by. Vitest exports its
 * `package.json`. Falls back to 5 when it cannot be read.
 */
export function readLiveVitestMajor(root: string): number {
  try {
    const file = createRequire(join(root, 'package.json')).resolve('vitest/package.json')
    const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown }
    const major = typeof version === 'string' ? Number.parseInt(version, 10) : Number.NaN

    return Number.isInteger(major) && major > 0 ? major : DEFAULT_MAJOR
  } catch {
    return DEFAULT_MAJOR
  }
}
