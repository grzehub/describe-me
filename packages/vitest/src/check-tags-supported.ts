import { readVitestVersion } from './read-vitest-version.js'
import type { StoriesMode } from './stories-mode.js'

/**
 * Test tags arrived in Vitest 4.1. Without them `stories: 'tagged'` would
 * record nothing, so an older Vitest fails before any test runs. A version
 * that cannot be read passes.
 */
export function checkTagsSupported(stories: StoriesMode, root: string): void {
  if (stories !== 'tagged') {
    return
  }

  const version = readVitestVersion(root)

  if (version === null || version.major > 4 || (version.major === 4 && version.minor >= 1)) {
    return
  }

  throw new Error(
    `describe-me: stories: 'tagged' needs test tags, which arrived in Vitest 4.1. This project resolves Vitest ${version.major}.${version.minor}.`,
  )
}
