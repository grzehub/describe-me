/**
 * The fixture part of `check-live`. For each example it runs the tests in
 * `live-fixtures/` under Vitest with `LIVE_FIXTURES=1`, starts the live
 * preview on the same config, and shows every test of the fixtures manifest:
 * each one must reach the status of the expectation table, and each mounted
 * one must send a size, load once and log no error. Then react-jsdom without
 * `live.setupFiles` must report `setup-failed` for server.node.ts, and with
 * `live: false` the server must refuse to start and `describe-me dev` must
 * run without Live. Last, the optimizer's `exclude` and the name rules of
 * both Vitest majors are checked on the built output.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { liveOptimizeDeps } from '../../packages/vitest/dist/live-optimize-deps.js'
import { exampleNames } from '../docs/example-names.mjs'
import { repoRoot } from '../docs/repo-root.mjs'
import { checkLiveOffViewer, startDev, stopDev } from './dev-server.mjs'
import { FIXTURE_EXPECTATIONS } from './fixture-expectations.mjs'
import {
  checkQuiet,
  checkSize,
  errorMessage,
  FIRST_STATUS_TIMEOUT,
  importCreateLiveServer,
  LIVE_ENV,
  manifestTests,
  openHost,
  readManifest,
  show,
  STATUS_TIMEOUT,
} from './live-frame.mjs'
import { checkNameCases } from './name-cases.mjs'

export const FIXTURE_ENV = 'LIVE_FIXTURES'
export const FIXTURES_DIR = join('node_modules', '.describe-me-live-fixtures')
export const LIVE_OFF = 'DESCRIBE_ME_LIVE_OFF'
export const SETUP_EXAMPLE = 'react-jsdom'

const CONFIG_FILE = 'vitest.config.ts'
const NODE_SETUP_FILE = 'live-fixtures/server.node.ts'
// The variables the example configs read, as `runFixtures` in check-act-parity.mjs clears them.
const CLEARED_ENV = ['ACT_PARITY', 'DESCRIBE_ME', 'BENCH_MICRO', 'BENCH_OUT', 'BENCH_SKIP']

/** Runs the example's live fixtures under Vitest, which proves the expected steps against Vitest itself. */
function runFixtures(root, name) {
  const env = { ...process.env }

  for (const variable of [...CLEARED_ENV, FIXTURE_ENV, LIVE_ENV]) {
    delete env[variable]
  }

  env[FIXTURE_ENV] = '1'

  const manifest = join(root, FIXTURES_DIR, 'manifest.json')

  rmSync(manifest, { force: true })

  // No `--reporter`: it would replace describe-me's reporter, which writes the manifest.
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

  // Vitest colours its output when `CI` is set.
  const output = stripVTControlCharacters(`${result.stdout ?? ''}${result.stderr ?? ''}`)
  const label = `${name} fixtures: LIVE_FIXTURES=1 vitest run`

  if (result.error) {
    return [`${label} did not start: ${errorMessage(result.error)}`]
  }

  if (result.status !== 0) {
    const tail = output.trimEnd().split('\n').slice(-30).join('\n')

    return [`${label} exited with ${result.status}:\n${tail}`]
  }

  return existsSync(manifest) ? [] : [`${label} wrote no ${FIXTURES_DIR}/manifest.json`]
}

/** `createLiveServer()` with LIVE_FIXTURES set while it starts, and only then. */
async function createFixtureServer(root, mode) {
  const createLiveServer = await importCreateLiveServer(root)

  process.env[FIXTURE_ENV] = mode

  try {
    return await createLiveServer({ root, configFile: CONFIG_FILE })
  } finally {
    delete process.env[FIXTURE_ENV]
  }
}

function labelOf(context, test) {
  const occurrence = test.occurrence > 1 ? ` (#${test.occurrence})` : ''

  return `${context.name} fixtures ${test.file} ${test.fullName}${occurrence}`
}

/** Shows one fixture test: its status, then for a mounted one its size, its behaviour and quiet. */
async function checkFixtureTest(context, test, expected, timeout) {
  const label = labelOf(context, test)
  const status = await show(context, test, timeout)

  if (status === null) {
    return { problems: [`${label}: no status within ${timeout / 1000} s`] }
  }

  if (status.status !== expected.status) {
    const detail = status.detail ? `: ${status.detail.split('\n')[0]}` : ''

    return { problems: [`${label}: ${status.status}${detail}, expected ${expected.status}`] }
  }

  if (expected.detail !== undefined && !status.detail?.includes(expected.detail)) {
    return { problems: [`${label}: the detail does not name ${expected.detail}: ${status.detail}`] }
  }

  if (status.status !== 'mounted') {
    return { problems: [] }
  }

  const problems = await checkSize(context, label, status)
  const behaved = expected.check === undefined ? null : await expected.check({ ...context, test })

  problems.push(...(behaved ?? []).map((problem) => `${label}: ${problem}`))
  problems.push(...(await checkQuiet(context, label)))

  return { problems, behaved: behaved !== null && behaved.length === 0 }
}

/** Every test of the fixtures manifest against the table, and every row of the table against the manifest. */
export async function checkFixtureTests(context, manifest, expectations) {
  const tests = manifestTests(manifest)
  const result = { problems: [], passed: 0, behaviours: 0, total: tests.length }

  for (const name of Object.keys(expectations)) {
    if (!tests.some((test) => test.fullName === name)) {
      result.problems.push(`${context.name} fixtures: the manifest has no test ${name}`)
    }
  }

  for (const [index, test] of tests.entries()) {
    const expected = expectations[test.fullName]

    if (expected === undefined) {
      result.problems.push(`${labelOf(context, test)}: no expectation in fixture-expectations.mjs`)
      continue
    }

    const timeout = index === 0 ? FIRST_STATUS_TIMEOUT : STATUS_TIMEOUT
    const checked = await checkFixtureTest(context, test, expected, timeout)

    result.problems.push(...checked.problems)
    result.passed += checked.problems.length === 0 ? 1 : 0
    result.behaviours += checked.behaved ? 1 : 0
  }

  return result
}

async function checkExampleFixtures(browser, host, name) {
  const root = join(repoRoot, 'examples', name)
  const ran = runFixtures(root, name)

  if (ran.length > 0) {
    return { problems: ran, passed: 0, behaviours: 0, total: 0 }
  }

  const manifest = readManifest(root, name, FIXTURES_DIR)
  const server = await createFixtureServer(root, '1')
  const context = await openHost(browser, host, name, server.base)

  try {
    return await checkFixtureTests(context, manifest, FIXTURE_EXPECTATIONS[name])
  } finally {
    await context.close()
    await server.close()
  }
}

/**
 * Without `live.setupFiles`, the Node-only setup file stops the live page at
 * `base` with `setup-failed`, which names the file and `node:fs`.
 */
export async function checkSetupFailedAt(browser, host, base) {
  const root = join(repoRoot, 'examples', SETUP_EXAMPLE)
  const [test] = manifestTests(readManifest(root, SETUP_EXAMPLE, FIXTURES_DIR))
  const context = await openHost(browser, host, `${SETUP_EXAMPLE} no-live-setup`, base)
  const label = `${context.name} ${test.fullName}`

  try {
    const status = await show(context, test, FIRST_STATUS_TIMEOUT)

    if (status?.status !== 'setup-failed') {
      return [`${label}: expected setup-failed, got ${status?.status ?? 'no status'}`]
    }

    const problems = []
    const detail = status.detail ?? ''

    if (!detail.startsWith(`${NODE_SETUP_FILE}: `) || !detail.includes('node:fs')) {
      problems.push(`${label}: the detail should name ${NODE_SETUP_FILE} and node:fs: ${detail}`)
    }

    if (!(await context.frame.locator('body').innerText()).includes('setup-failed')) {
      problems.push(`${label}: the page does not show setup-failed`)
    }

    return problems
  } finally {
    await context.close()
  }
}

/** The setup-failed check on the live server. */
async function checkSetupFailed(browser, host) {
  const root = join(repoRoot, 'examples', SETUP_EXAMPLE)
  const server = await createFixtureServer(root, 'no-live-setup')

  try {
    return await checkSetupFailedAt(browser, host, server.base)
  } finally {
    await server.close()
  }
}

/** With `live: false`, `createLiveServer()` rejects with its code, and `describe-me dev` runs without Live. */
async function checkLiveOff(browser) {
  const root = join(repoRoot, 'examples', SETUP_EXAMPLE)
  const label = `${SETUP_EXAMPLE} live: false`
  const problems = []

  try {
    const server = await createFixtureServer(root, 'off')

    await server.close()
    problems.push(`${label}: createLiveServer() started a server`)
  } catch (error) {
    if (error?.code !== LIVE_OFF) {
      problems.push(
        `${label}: createLiveServer() rejected with code ${error?.code}, expected ${LIVE_OFF}: ${errorMessage(error)}`,
      )
    }
  }

  if (process.env[LIVE_ENV] !== undefined) {
    problems.push(`${label}: ${LIVE_ENV} is still set after createLiveServer()`)
  }

  const dev = await startDev(root, FIXTURES_DIR, [], { [FIXTURE_ENV]: 'off' })

  try {
    const viewer = await checkLiveOffViewer(browser, dev)
    const lines = dev.output().split('\n')

    problems.push(...viewer.map((problem) => `${label}, describe-me dev: ${problem}`))

    if (!lines.some((line) => line.includes('live: false'))) {
      problems.push(`${label}: describe-me dev printed no line with live: false:\n${dev.output()}`)
    }
  } finally {
    await stopDev(dev)
  }

  return problems
}

/** A package that imports `vitest` must reach the shim, so the optimizer leaves `vitest` out. */
function checkOptimizerExclude() {
  const root = join(repoRoot, 'examples', SETUP_EXAMPLE)
  const { exclude } = liveOptimizeDeps(root, undefined, '@describe-me/react/live-testing-library')

  return ['vitest', '@vitest/browser/context']
    .filter((specifier) => !exclude.includes(specifier))
    .map(
      (specifier) => `liveOptimizeDeps(): exclude has no ${specifier}: ${JSON.stringify(exclude)}`,
    )
}

/** Runs the whole fixture part, and returns its problems and its part of the summary line. */
export async function checkFixtures(browser, host) {
  const problems = []
  const counts = []
  let behaviours = 0

  for (const name of exampleNames) {
    try {
      const result = await checkExampleFixtures(browser, host, name)

      problems.push(...result.problems)
      counts.push(`${name} ${result.passed}/${result.total}`)
      behaviours += result.behaviours
    } catch (error) {
      problems.push(`${name} fixtures: ${errorMessage(error)}`)
    }
  }

  for (const check of [() => checkSetupFailed(browser, host), () => checkLiveOff(browser)]) {
    try {
      problems.push(...(await check()))
    } catch (error) {
      problems.push(errorMessage(error))
    }
  }

  problems.push(...checkOptimizerExclude())

  const names = checkNameCases()

  problems.push(...names.problems)

  return {
    problems,
    summary: `fixtures ${counts.join(', ')}, ${behaviours} behaviours, setup-failed, live: false, optimizeDeps.exclude, ${names.cases} name cases`,
  }
}
