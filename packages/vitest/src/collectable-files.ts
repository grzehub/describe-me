import { readdirSync } from 'node:fs'

/**
 * The names of the entries in `dir` that garbage collection may delete. No
 * store writes a folder, so a folder belongs to someone else and is left out.
 */
export function collectableFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => entry.name)
}
