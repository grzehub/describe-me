/**
 * The site of examples/shadcn built against its SHADCN_CHANGED=1 run with
 * `describe-me build --base`, for check-site: the run recorded when it is
 * missing, the build into a temp directory, the report of `describe-me diff
 * --out` for the same pair, and the checks of the site's files.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { machinePathsIn } from '../docs/machine-paths-in.mjs'
import { repoRoot } from '../docs/repo-root.mjs'

const SHADCN = join(repoRoot, 'examples', 'shadcn')
const CHANGED_MANIFEST = join(SHADCN, 'node_modules', '.describe-me-changed', 'manifest.json')
const BIN = join(repoRoot, 'packages', 'viewer', 'bin', 'describe-me.js')
// Relative to the repository, as a reader would type them.
const PAIR = [
  '--base',
  'examples/shadcn/.describe-me',
  '--data',
  'examples/shadcn/node_modules/.describe-me-changed',
]

const META = '<meta name="describe-me-changes" content="__data/changes.json">'
const PROJECT_ID = /^[0-9a-f]{16}$/
const OUTPUT_LINES = 15

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
}

/** The last lines of a command's output, for a problem. */
function tail(result) {
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()

  return text.split('\n').slice(-OUTPUT_LINES).join('\n')
}

/**
 * Records shadcn's SHADCN_CHANGED=1 run when its manifest is missing, as
 * check-diff's `runShadcn` does. Returns a problem or `null`.
 */
function recordChangedRun() {
  if (existsSync(CHANGED_MANIFEST)) {
    return null
  }

  const result = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: SHADCN,
    env: { ...process.env, SHADCN_CHANGED: '1' },
    encoding: 'utf8',
  })

  if (result.status !== 0 || !existsSync(CHANGED_MANIFEST)) {
    return `recording examples/shadcn with SHADCN_CHANGED=1 failed (exit ${result.status}):\n${tail(result)}`
  }

  console.log(
    'check-site: recorded examples/shadcn with SHADCN_CHANGED=1 into node_modules/.describe-me-changed',
  )

  return null
}

function describeMe(args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd: repoRoot, encoding: 'utf8' })
}

/** The files of the pair site, each a problem. */
function fileProblems(site, report) {
  const data = readJson(join(site, '__data', 'manifest.json'))
  const base = readJson(join(site, '__base', 'manifest.json'))
  const changes = readJson(join(site, '__data', 'changes.json'))
  const html = readFileSync(join(site, 'index.html'), 'utf8')
  const problems = []

  if (base === undefined) {
    problems.push('__base/manifest.json is missing')
  } else if (base.root !== data?.root || !PROJECT_ID.test(String(base.root))) {
    problems.push(`the roots are ${base.root} in __base and ${data?.root} in __data`)
  }

  if (!isDeepStrictEqual(changes, report)) {
    problems.push('__data/changes.json differs from the changes.json of describe-me diff --out')
  }

  if (!html.includes(META)) {
    problems.push('index.html has no describe-me-changes meta')
  }

  problems.push(...machinePathsIn(site, { 'the checkout': repoRoot }).problems)

  return problems
}

/** No viewer of site/ built without `--base` has a base, a report or the meta. */
function noBaseProblems(siteDir, names) {
  const problems = []

  for (const name of names) {
    const viewer = join(siteDir, 'examples', name)
    const html = readFileSync(join(viewer, 'index.html'), 'utf8')

    if (existsSync(join(viewer, '__base'))) {
      problems.push(`site/examples/${name}/ has __base/`)
    }

    if (existsSync(join(viewer, '__data', 'changes.json'))) {
      problems.push(`site/examples/${name}/ has __data/changes.json`)
    }

    if (html.includes('describe-me-changes')) {
      problems.push(`site/examples/${name}/index.html has the describe-me-changes meta`)
    }
  }

  return problems
}

/**
 * Builds the pair site with `--live` into `temp`, a temp directory the caller
 * removes, and checks its files and those of site/'s viewers. `site` is
 * absent when it could not be built. `report` and `manifest` are what the
 * site's viewer loads.
 */
export function preparePairSite(temp, siteDir, names) {
  const site = join(temp, 'site')
  const diffOut = join(temp, 'diff')
  const problems = noBaseProblems(siteDir, names)
  const recorded = recordChangedRun()

  if (recorded !== null) {
    return { problems: [...problems, recorded] }
  }

  const built = describeMe(['build', ...PAIR, '--out', site, '--live', '--no-vendor-fonts'])

  if (built.status !== 0) {
    return { problems: [...problems, `build --base exited ${built.status}:\n${tail(built)}`] }
  }

  const diffed = describeMe(['diff', ...PAIR, '--out', diffOut])
  const report = readJson(join(diffOut, 'changes.json'))

  if (diffed.status !== 0 || report === undefined) {
    return { problems: [...problems, `diff --out exited ${diffed.status}:\n${tail(diffed)}`] }
  }

  problems.push(...fileProblems(site, report))

  if (problems.length === 0) {
    console.log(
      'check-site: the shadcn pair site has __base/ named by the project id, the report of diff --out as __data/changes.json and the meta in index.html, and names no machine path. No viewer of site/ has __base/, changes.json or the meta',
    )
  }

  return {
    site,
    report,
    manifest: readJson(join(site, '__data', 'manifest.json')),
    problems,
  }
}
