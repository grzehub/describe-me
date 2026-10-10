import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const DECLARED = /\bexport\s+const\s+([A-Za-z_$][\w$]*)/g
const KNOWN_NAMES = ['page', 'server', 'userEvent', 'cdp', 'commands', 'locators', 'utils']

/**
 * The names that the project's `vitest/browser` declares. Importing it in
 * Node throws, but its file still declares every name for static analysis.
 */
export function readLiveBrowserNames(root: string): string[] {
  try {
    const file = createRequire(join(root, 'package.json')).resolve('vitest/browser')
    const names = Array.from(readFileSync(file, 'utf8').matchAll(DECLARED), (match) => match[1])

    return names.length > 0 ? [...new Set(names)] : KNOWN_NAMES
  } catch {
    return KNOWN_NAMES
  }
}
