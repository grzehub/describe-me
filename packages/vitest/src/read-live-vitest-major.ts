import { readVitestVersion } from './read-vitest-version.js'

const DEFAULT_MAJOR = 5

/**
 * The major version of the `vitest` that the root resolves, whose rules the
 * live page names `each` and `for` rows by. Falls back to 5 when it cannot be
 * read.
 */
export function readLiveVitestMajor(root: string): number {
  return readVitestVersion(root)?.major ?? DEFAULT_MAJOR
}
