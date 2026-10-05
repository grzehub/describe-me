import { createRequire } from 'node:module'
import { join } from 'node:path'
import { repoRoot } from './repo-root.mjs'

/**
 * Playwright from examples/react-browser, its only home in the repository, so
 * the root needs no copy of its own.
 */
export function loadPlaywright() {
  const require = createRequire(join(repoRoot, 'examples', 'react-browser', 'package.json'))

  try {
    return require('playwright')
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)

    throw new Error(
      `cannot load playwright (${reason}). Run pnpm install and pnpm --filter react-browser exec playwright install chromium.`,
    )
  }
}
