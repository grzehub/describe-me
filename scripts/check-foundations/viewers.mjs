/**
 * Static builds of the viewer for the outputs that check-foundations reads,
 * plus a copy of react-browser's output without foundations, served from one
 * temp directory the way a static host would.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../docs/repo-root.mjs'
import { serveStatic } from '../docs/serve-static.mjs'

const CLI = join(repoRoot, 'packages', 'viewer', 'bin', 'describe-me.js')

/** The label of the copy whose manifest has no `foundations` and which has no `foundations.json`. */
export const WITHOUT_FOUNDATIONS = 'react-browser without foundations'

function slugOf(label) {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-')
}

/** The call of scripts/build-site.mjs, without `--live`. */
function build(dataDir, outDir) {
  const result = spawnSync(
    process.execPath,
    [CLI, 'build', '--data', dataDir, '--out', outDir, '--no-vendor-fonts'],
    { cwd: repoRoot, encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`describe-me build failed: ${result.stderr || result.stdout}`)
  }
}

function copyWithoutFoundations(source, dir) {
  cpSync(source, dir, { recursive: true })
  rmSync(join(dir, 'foundations.json'), { force: true })

  const file = join(dir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  delete manifest.foundations
  writeFileSync(file, JSON.stringify(manifest))
}

/**
 * Build a viewer for every output, and the copy without foundations when
 * react-browser is among them. Resolves with the server and each viewer's URL
 * by label, every URL ending with `/`.
 */
export async function serveViewers(outputs, tempDir) {
  const root = tempDir()
  const slugs = {}

  for (const [label, { outDir }] of Object.entries(outputs)) {
    build(outDir, join(root, slugOf(label)))
    slugs[label] = slugOf(label)
  }

  if (outputs['react-browser']) {
    const data = join(tempDir(), 'data')
    copyWithoutFoundations(outputs['react-browser'].outDir, data)
    build(data, join(root, slugOf(WITHOUT_FOUNDATIONS)))
    slugs[WITHOUT_FOUNDATIONS] = slugOf(WITHOUT_FOUNDATIONS)
  }

  const { server, url } = await serveStatic(root)
  const urls = Object.fromEntries(
    Object.entries(slugs).map(([label, slug]) => [label, `${url}${slug}/`]),
  )

  return { server, urls }
}
