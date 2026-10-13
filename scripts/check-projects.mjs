/**
 * Checks that tests record in inline `test.projects`, which in Vitest 5 share
 * the root's Vite server and never reach the plugin's `config` hook. It runs
 * `examples/react-jsdom` with `PROJECTS=1`: `src/` as a project with
 * `extends: true` and `projects/` as one without `extends`, which Vitest 5
 * extends from the root config by default. Every test must pass, so no test
 * leaves its component mounted for the next one, and the manifest must hold
 * the same stories as the plain run of the example. Run after `pnpm build`
 * and the example's tests. Exits 1 on the first mismatch.
 *
 * Usage: `node scripts/check-projects.mjs`
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const EXAMPLE = fileURLToPath(new URL('../examples/react-jsdom/', import.meta.url))
const OUT_DIR = join(EXAMPLE, 'node_modules/.describe-me-projects')
const PLAIN_MANIFEST = join(EXAMPLE, '.describe-me/manifest.json')
const LEAK_MODULE = 'projects/leak.test.tsx'

function fail(name, detail, notes = []) {
  console.error(`FAIL  ${name} (${detail})`)

  for (const note of notes) {
    console.error(`      ${note}`)
  }

  console.error('check-projects: stopped at the first mismatch')
  process.exit(1)
}

function pass(name) {
  console.log(`ok    ${name}`)
}

function readManifest(file, name) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    fail(name, `cannot read ${file}`, ['Run the example’s tests first.'])
  }
}

/** Every test of the given modules as `<module> > <full name>`, sorted. */
function testsOf(manifest, keep) {
  return manifest.modules
    .filter((mod) => keep(mod.id))
    .flatMap((mod) => mod.tests.map((test) => `${mod.id} > ${test.fullName}`))
    .sort()
}

function runProjects() {
  const name = 'vitest with PROJECTS=1 passes, so no test leaves its component mounted'
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: EXAMPLE,
    env: { ...process.env, PROJECTS: '1' },
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    fail(name, `exit ${result.status}`, [result.stdout, result.stderr])
  }

  pass(name)
}

function checkManifest() {
  const plain = readManifest(PLAIN_MANIFEST, 'the plain run of the example')
  const projects = readManifest(join(OUT_DIR, 'manifest.json'), 'the run with projects')
  const expected = testsOf(plain, (id) => id.startsWith('src/'))
  const actual = testsOf(projects, (id) => id.startsWith('src/'))

  if (expected.length === 0) {
    fail('the plain manifest has stories', 'none found', [PLAIN_MANIFEST])
  }

  if (!isDeepStrictEqual(actual, expected)) {
    const missing = expected.filter((test) => !actual.includes(test))
    const extra = actual.filter((test) => !expected.includes(test))

    fail('the project with extends: true records the same stories as the plain run', 'mismatch', [
      ...missing.map((test) => `missing ${test}`),
      ...extra.map((test) => `extra   ${test}`),
    ])
  }

  pass(
    `the project with extends: true records the same ${expected.length} stories as the plain run`,
  )

  const leak = testsOf(projects, (id) => id === LEAK_MODULE)

  if (leak.length !== 2) {
    fail('the project without extends records', `${leak.length} tests`, [
      `expected 2 tests in ${LEAK_MODULE}`,
    ])
  }

  pass('the project without extends records')
}

rmSync(OUT_DIR, { recursive: true, force: true })
runProjects()
checkManifest()
console.log('check-projects: ok')
