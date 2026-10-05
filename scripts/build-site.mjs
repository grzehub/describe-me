/**
 * Builds the docs site into site/: the pages of docs/ with docs.css and
 * favicon.svg, and the static viewer of each example under
 * site/examples/<name>/. Needs `pnpm build` and both examples' tests.
 * `--no-vendor-fonts` goes to `describe-me build`, which then downloads no
 * web fonts.
 *
 * Usage: `node scripts/build-site.mjs [--no-vendor-fonts]`
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { exampleNames } from './docs/example-names.mjs'
import { pages } from './docs/pages.mjs'
import { repoRoot } from './docs/repo-root.mjs'

const ASSETS = ['docs.css', 'favicon.svg']
const SITE = join(repoRoot, 'site')
const CLI = join(repoRoot, 'packages', 'viewer', 'bin', 'describe-me.js')
const CLI_BUILD = join(repoRoot, 'packages', 'viewer', 'dist-cli', 'main.js')

const { values } = parseArgs({
  options: { 'vendor-fonts': { type: 'boolean', default: true } },
  allowNegative: true,
})

function stop(message) {
  console.error(`site:build: ${message}`)
  process.exit(1)
}

if (!existsSync(CLI_BUILD)) {
  stop('the describe-me CLI is not built. Run pnpm build first')
}

for (const name of exampleNames) {
  const manifest = join(repoRoot, 'examples', name, '.describe-me', 'manifest.json')

  if (!existsSync(manifest)) {
    stop(`${relative(repoRoot, manifest)} is missing. Run pnpm --filter ${name} test first`)
  }
}

rmSync(SITE, { recursive: true, force: true })
mkdirSync(SITE, { recursive: true })

for (const file of [...pages.map((page) => page.file), ...ASSETS]) {
  copyFileSync(join(repoRoot, 'docs', file), join(SITE, file))
}

for (const name of exampleNames) {
  const args = [
    CLI,
    'build',
    '--data',
    join('examples', name, '.describe-me'),
    '--out',
    join('site', 'examples', name),
  ]

  if (!values['vendor-fonts']) {
    args.push('--no-vendor-fonts')
  }

  console.log(`site:build: examples/${name}`)

  const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: 'inherit' })

  if (result.status !== 0) {
    stop(`describe-me build failed for examples/${name}`)
  }
}

console.log(
  `site:build: ${pages.length} pages and ${exampleNames.length} viewers in site/. Serve them with pnpm site:serve`,
)
