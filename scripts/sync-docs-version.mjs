/**
 * Sets the version in the topbar of every page in docs/ to the version of
 * packages/viewer/package.json. `pnpm version-packages` runs it, so a release
 * PR carries the new version into the docs too.
 *
 * Usage: `node scripts/sync-docs-version.mjs`
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './docs/repo-root.mjs'
import { versionSpan } from './docs/version-span.mjs'

const DOCS = join(repoRoot, 'docs')
const VIEWER_PACKAGE = join(repoRoot, 'packages', 'viewer', 'package.json')

const { version } = JSON.parse(readFileSync(VIEWER_PACKAGE, 'utf8'))
const span = `<span class="version">v${version}</span>`
const files = readdirSync(DOCS).filter((name) => name.endsWith('.html'))
const changed = []

for (const file of files.sort()) {
  const path = join(DOCS, file)
  const html = readFileSync(path, 'utf8')
  const synced = html.replace(versionSpan, span)

  if (synced !== html) {
    writeFileSync(path, synced)
    changed.push(file)
  }
}

if (changed.length === 0) {
  console.log(`sync-docs-version: every page shows v${version}`)
} else {
  console.log(`sync-docs-version: set v${version} on ${changed.join(', ')}`)
}
