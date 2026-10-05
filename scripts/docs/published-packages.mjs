import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './repo-root.mjs'

const DIRECTORIES = ['packages/core', 'packages/react', 'packages/vitest', 'packages/viewer']

/** The four published packages: `name`, the repo-relative `dir` and the parsed `json` of each. */
export function publishedPackages() {
  return DIRECTORIES.map((dir) => {
    const json = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'))

    return { name: json.name, dir, json }
  })
}
