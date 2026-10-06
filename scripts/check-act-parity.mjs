/**
 * Checks that recording neither adds nor hides React act warnings in jsdom. On
 * the built output, it checks that @describe-me/vitest's `actNeutralWait` turns
 * `IS_REACT_ACT_ENVIRONMENT` off for a wait and restores it, that the recorder
 * of @describe-me/core runs its waits through `aroundWait`, and that the check
 * @describe-me/react publishes for Testing Library's `asyncWrapper` reaches
 * the reader of @describe-me/vitest. Then it runs
 * `examples/react-jsdom/act-parity/` three times: recording off, recording on
 * with lazy render frames, and recording on with eager ones after a setup file
 * that loads Testing Library first. Each recording run must pass as many tests
 * and log the same act warnings, component by component, as the run without.
 * Run after `pnpm build`. Exits 1 on the first mismatch.
 *
 * Usage: `node scripts/check-act-parity.mjs`
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual, stripVTControlCharacters } from 'node:util'
import { recorder } from '../packages/core/dist/recorder.js'
import { publishTestingLibraryAct } from '../packages/react/dist/publish-testing-library-act.js'
import { actNeutralWait } from '../packages/vitest/dist/act-neutral-wait.js'
import { testingLibraryWrapsInAct } from '../packages/vitest/dist/testing-library-wraps-in-act.js'

const EXAMPLE = fileURLToPath(new URL('../examples/react-jsdom/', import.meta.url))
const MANIFEST = new URL('../examples/react-jsdom/.describe-me/manifest.json', import.meta.url)

// `SlowSave.test.tsx` and the bare-sleep test of `UsernameField.test.tsx` in
// `act-parity/` warn with recording on and off by design, so a count of zero
// cannot pass for parity when the warnings never reach the output.
const BASELINE = 2

const NOT_WRAPPED = /not wrapped in act\(/g
const NOT_CONFIGURED = /not configured to support act\(/g
const UPDATE = /An update to (\S+) inside a test/g
const PASSED = /^\s*Tests\s+.*?(\d+) passed/m

// The key both packages agree on, see `publish-testing-library-act.ts`.
const ACT_CHECK = Symbol.for('describe-me.testing-library-act')

// Testing Library has no `exports` map, so this is the CommonJS instance the
// publisher imports. Plain Node has no `beforeAll`, so loading it leaves the
// act flag alone.
const { configure } = createRequire(new URL('../packages/react/package.json', import.meta.url))(
  '@testing-library/react',
)

const RUNS = {
  off: { label: 'recording off', env: { ACT_PARITY: '1', DESCRIBE_ME: 'off' } },
  lazy: { label: 'recording on, lazy', env: { ACT_PARITY: '1' } },
  eager: { label: 'recording on, eager', env: { ACT_PARITY: 'eager' } },
}

const RENDER_LABEL = '<Card title="Hi" />'
const ACTION_LABEL = 'click(button "Save")'
const BROKEN_SELECTOR = '[aria-busy="true"]]'

const host = globalThis

function fail(name, detail, notes = []) {
  console.error(`FAIL  ${name} (${detail})`)

  for (const note of notes) {
    console.error(`      ${note}`)
  }

  console.error('check-act-parity: stopped at the first mismatch')
  process.exit(1)
}

function pass(name) {
  console.log(`ok    ${name}`)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function shown(value) {
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function flag() {
  return host.IS_REACT_ACT_ENVIRONMENT
}

/** A wait that stays open until `close()` is called. */
function openWait() {
  let close
  const closed = new Promise((resolve) => {
    close = resolve
  })

  return { wait: () => closed, close }
}

/** The flag as a wait inside `actNeutralWait` sees it. */
async function flagDuringWait() {
  let during

  await actNeutralWait(async () => {
    during = flag()
  })

  return during
}

async function checkWindow() {
  const name = 'actNeutralWait: the flag is true before, false during and true after'
  host.IS_REACT_ACT_ENVIRONMENT = true

  const seen = [flag(), await flagDuringWait(), flag()]

  if (!isDeepStrictEqual(seen, [true, false, true])) {
    fail(name, `saw ${shown(seen)}`)
  }

  pass(name)
}

async function checkNested() {
  const name = 'actNeutralWait: a nested window leaves the flag off until the outer one ends'
  host.IS_REACT_ACT_ENVIRONMENT = true
  const seen = []

  await actNeutralWait(async () => {
    seen.push(await flagDuringWait())
    seen.push(flag())
  })

  seen.push(flag())

  if (!isDeepStrictEqual(seen, [false, false, true])) {
    fail(name, `saw ${shown(seen)}`)
  }

  pass(name)
}

async function checkOverlapping() {
  for (const order of [
    ['first', 'second'],
    ['second', 'first'],
  ]) {
    const name = `actNeutralWait: two overlapping windows restore the flag once, the ${order[0]} closing first`
    host.IS_REACT_ACT_ENVIRONMENT = true

    const waits = { first: openWait(), second: openWait() }
    const windows = {
      first: actNeutralWait(waits.first.wait),
      second: actNeutralWait(waits.second.wait),
    }

    const seen = [flag()]

    for (const which of order) {
      waits[which].close()
      await windows[which]
      seen.push(flag())
    }

    if (!isDeepStrictEqual(seen, [false, false, true])) {
      fail(name, `saw ${shown(seen)}`)
    }

    pass(name)
  }
}

async function checkRestoresSentinel() {
  const name = 'actNeutralWait: restores a value that is not a boolean as is'
  const sentinel = { sentinel: true }
  host.IS_REACT_ACT_ENVIRONMENT = sentinel

  const during = await flagDuringWait()

  if (during !== false || flag() !== sentinel) {
    fail(name, `saw ${shown(during)} during and ${shown(flag())} after`)
  }

  pass(name)
}

async function checkRestoresUndefined() {
  const name = 'actNeutralWait: restores undefined'
  delete host.IS_REACT_ACT_ENVIRONMENT

  const during = await flagDuringWait()

  if (during !== false || flag() !== undefined) {
    fail(name, `saw ${shown(during)} during and ${shown(flag())} after`)
  }

  pass(name)
}

async function checkRejection() {
  const name = 'actNeutralWait: a rejected wait restores the flag and rejects'
  const error = new Error('the wait failed')
  host.IS_REACT_ACT_ENVIRONMENT = true

  let caught

  try {
    await actNeutralWait(async () => {
      throw error
    })
  } catch (thrown) {
    caught = thrown
  }

  if (caught !== error) {
    fail(name, caught === undefined ? 'it resolved' : `it rejected with ${errorMessage(caught)}`)
  }

  if (flag() !== true) {
    fail(name, `the flag is ${shown(flag())} after`)
  }

  pass(name)
}

/** An `aroundWait` that counts its calls. */
function countingWrapper() {
  const counter = {
    calls: 0,
    async aroundWait(wait) {
      counter.calls++
      await wait()
    },
  }

  return counter
}

// Each wait ends after `end()`, so the generation check skips the snapshot and
// no DOM is needed.
async function checkRecorderWaits() {
  const counter = countingWrapper()

  recorder.configure({ aroundWait: counter.aroundWait })
  recorder.configure({ renderFrame: 'lazy' })

  const actionName =
    "recorder: an action capture runs one wait through aroundWait, kept by configure({ renderFrame: 'lazy' })"

  recorder.begin()
  const action = recorder.capture('action', ACTION_LABEL)
  recorder.end()
  await action

  if (counter.calls !== 1) {
    fail(actionName, `aroundWait ran ${counter.calls} times`)
  }

  pass(actionName)

  const renderName = 'recorder: a lazy render capture runs no wait'
  recorder.begin()
  await recorder.capture('render', RENDER_LABEL)

  if (counter.calls !== 1) {
    fail(renderName, `aroundWait ran ${counter.calls - 1} times`)
  }

  pass(renderName)

  const flushName = 'recorder: flush() after a lazy render capture runs one wait through aroundWait'
  const flushing = recorder.flush()
  recorder.end()
  await flushing

  if (counter.calls !== 2) {
    fail(flushName, `aroundWait ran ${counter.calls - 1} times`)
  }

  pass(flushName)
}

async function checkRejectedSelector() {
  const name = 'recorder: configure() with a pending selector the DOM rejects still sets aroundWait'
  const counter = countingWrapper()
  const warn = console.warn

  globalThis.document = {
    querySelector() {
      throw new SyntaxError(`'${BROKEN_SELECTOR}' is not a valid selector`)
    },
  }

  console.warn = () => {}

  try {
    recorder.configure({
      aroundWait: counter.aroundWait,
      renderFrame: { pending: BROKEN_SELECTOR },
    })
  } finally {
    delete globalThis.document
    console.warn = warn
  }

  recorder.begin()
  const action = recorder.capture('action', ACTION_LABEL)
  recorder.end()
  await action

  if (counter.calls !== 1) {
    fail(name, `the new aroundWait ran ${counter.calls} times`)
  }

  recorder.configure({})
  pass(name)
}

function checkActCheck(name, expected) {
  const seen = testingLibraryWrapsInAct()

  if (seen !== expected) {
    fail(name, `testingLibraryWrapsInAct() returned ${shown(seen)}`)
  }

  pass(name)
}

function checkTestingLibraryAct() {
  checkActCheck('testingLibraryWrapsInAct: false before the check is published', false)

  publishTestingLibraryAct()
  checkActCheck('testingLibraryWrapsInAct: true after publishTestingLibraryAct()', true)

  configure({ asyncUtilTimeout: 1000 })
  checkActCheck('testingLibraryWrapsInAct: still true after configure() with other options', true)

  configure({ asyncWrapper: (callback) => callback() })
  checkActCheck('testingLibraryWrapsInAct: false after configure() swaps the asyncWrapper', false)

  delete host[ACT_CHECK]
}

function manifestHash() {
  if (!existsSync(MANIFEST)) {
    return null
  }

  return createHash('sha256').update(readFileSync(MANIFEST)).digest('hex')
}

function count(output, pattern) {
  return output.match(pattern)?.length ?? 0
}

/** `CachedSearch 1, SlowSave 1`: the act warnings of a run by component. */
function tally(output) {
  const counts = new Map()

  for (const [, component] of output.matchAll(UPDATE)) {
    counts.set(component, (counts.get(component) ?? 0) + 1)
  }

  const entries = [...counts].sort(([left], [right]) => left.localeCompare(right))

  return entries.map(([component, total]) => `${component} ${total}`).join(', ') || 'none'
}

function passedTests(output) {
  const match = output.match(PASSED)

  return match ? Number(match[1]) : null
}

/**
 * Runs the fixtures with the default reporter, which prints the console of
 * passing tests. A reporter on the command line replaces the config's, the
 * describe-me reporter included, so the run writes nothing to `.describe-me/`.
 */
function runFixtures(mode) {
  const env = { ...process.env }

  delete env.ACT_PARITY
  delete env.DESCRIBE_ME
  delete env.BENCH_MICRO
  delete env.BENCH_OUT
  delete env.BENCH_SKIP
  Object.assign(env, mode.env)

  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--reporter=default'], {
    cwd: EXAMPLE,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

  // Vitest colors its output when `CI` is set.
  const output = stripVTControlCharacters(`${result.stdout ?? ''}${result.stderr ?? ''}`)

  return {
    label: mode.label,
    status: result.status,
    error: result.error,
    output,
    passed: passedTests(output),
    notWrapped: count(output, NOT_WRAPPED),
    notConfigured: count(output, NOT_CONFIGURED),
  }
}

function checkRun(run) {
  const name = `${run.label}: the fixtures pass`

  if (run.error) {
    fail(name, `vitest did not start: ${errorMessage(run.error)}`)
  }

  if (run.status !== 0) {
    fail(name, `exit code ${run.status}`, run.output.trimEnd().split('\n').slice(-40))
  }

  if (run.passed === null) {
    fail(name, 'no "Tests  N passed" line', run.output.trimEnd().split('\n').slice(-40))
  }

  pass(
    `${name}, ${run.passed} passed, ${run.notWrapped} "not wrapped in act", ${run.notConfigured} "not configured to support act"`,
  )
}

function checkConfigured(run) {
  const name = `${run.label}: logs no "not configured to support act"`

  if (run.notConfigured !== 0) {
    fail(name, `got ${run.notConfigured}`, [`${run.label}: ${tally(run.output)}`])
  }

  pass(name)
}

function checkParity(off, on) {
  const tallies = [off, on].map((run) => `${run.label}: ${tally(run.output)}`)
  const passedName = `${on.label}: passes as many tests as ${off.label}`

  if (on.passed !== off.passed) {
    fail(passedName, `${on.passed} on, ${off.passed} off`)
  }

  pass(passedName)

  const countName = `${on.label}: logs as many act warnings as ${off.label}`

  if (on.notWrapped !== off.notWrapped) {
    fail(countName, `${on.notWrapped} on, ${off.notWrapped} off`, tallies)
  }

  pass(countName)

  const tallyName = `${on.label}: logs the act warnings of the same components as ${off.label}`

  if (tally(on.output) !== tally(off.output)) {
    fail(tallyName, 'the components differ', tallies)
  }

  pass(`${tallyName}: ${tally(on.output)}`)
}

function checkWarnings(off, ons) {
  const baselineName = `${off.label} logs the ${BASELINE} act warnings of the baseline`

  if (off.notWrapped !== BASELINE) {
    fail(baselineName, `got ${off.notWrapped}`, [`${off.label}: ${tally(off.output)}`])
  }

  pass(`${baselineName}: ${tally(off.output)}`)

  for (const run of [off, ...ons]) {
    checkConfigured(run)
  }

  for (const on of ons) {
    checkParity(off, on)
  }
}

function checkManifestUntouched(before) {
  const name = 'the runs leave examples/react-jsdom/.describe-me/manifest.json untouched'
  const after = manifestHash()

  if (before === null && after !== null) {
    fail(name, 'they wrote it')
  }

  if (after !== before) {
    fail(name, 'they changed or removed it')
  }

  pass(name)
}

await checkWindow()
await checkNested()
await checkOverlapping()
await checkRestoresSentinel()
await checkRestoresUndefined()
await checkRejection()
await checkRecorderWaits()
await checkRejectedSelector()
checkTestingLibraryAct()

const manifestBefore = manifestHash()
const off = runFixtures(RUNS.off)
const ons = [runFixtures(RUNS.lazy), runFixtures(RUNS.eager)]

checkManifestUntouched(manifestBefore)

for (const run of [off, ...ons]) {
  checkRun(run)
}

checkWarnings(off, ons)
