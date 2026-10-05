import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleNames } from './example-names.mjs'
import { repoRoot } from './repo-root.mjs'

/**
 * The manifest of each example by name, as its last test run wrote it, or
 * `null` when that example's tests have not run yet.
 */
export function exampleManifests() {
  const manifests = {}

  for (const name of exampleNames) {
    const path = join(repoRoot, 'examples', name, '.describe-me', 'manifest.json')
    manifests[name] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
  }

  return manifests
}
