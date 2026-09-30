/**
 * Checks that @describe-me/core refuses a test recorder created by a copy of
 * core with another protocol, and that @describe-me/vitest names itself as the
 * manifest's generator, on their built output. Run after `pnpm build`. Exits 1
 * on the first failure.
 *
 * Usage: `node scripts/check-version-guard.mjs`
 */
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { readGenerator } from '../packages/vitest/dist/read-generator.js'

const RECORDER_KEY = Symbol.for('describe-me.recorder')
const SAME_VERSION = 'must be on the same version'

function fail(name, detail) {
  console.error(`FAIL  ${name} (${detail})`)
  console.error('check-version-guard: stopped at the first failure')
  process.exit(1)
}

function pass(name) {
  console.log(`ok    ${name}`)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** The query string makes Node evaluate a fresh copy of the module, like a second copy of core. */
async function importRecorder(query) {
  const { recorder } = await import(`../packages/core/dist/recorder.js?${query}`)

  return recorder
}

async function expectAccepted(name, query, planted) {
  globalThis[RECORDER_KEY] = planted

  let recorder

  try {
    recorder = await importRecorder(query)
  } catch (error) {
    fail(name, `threw: ${errorMessage(error)}`)
  }

  if (recorder !== planted) {
    fail(name, 'the import did not return the stored recorder')
  }

  pass(name)
}

async function expectRejected(name, query, planted, fragments) {
  globalThis[RECORDER_KEY] = planted

  let message

  try {
    await importRecorder(query)
  } catch (error) {
    message = errorMessage(error)
  }

  if (message === undefined) {
    fail(name, 'the import did not throw')
  }

  const missing = fragments.filter((fragment) => !message.includes(fragment))

  if (missing.length > 0) {
    fail(
      name,
      `the message lacks ${missing.map((fragment) => `"${fragment}"`).join(', ')}: ${message}`,
    )
  }

  pass(name)
}

async function checkFresh() {
  const name = 'fresh: creates, stores and stamps a recorder'
  delete globalThis[RECORDER_KEY]

  const recorder = await importRecorder('fresh')

  if (!Number.isInteger(recorder.protocol) || recorder.protocol < 1) {
    fail(name, `protocol is ${recorder.protocol}, expected a positive integer`)
  }

  if (globalThis[RECORDER_KEY] !== recorder) {
    fail(name, 'the global does not hold the exported recorder')
  }

  pass(name)

  return recorder
}

async function checkSameProtocol(first) {
  const name = 'same protocol: reuses the stored recorder'
  const recorder = await importRecorder('same-protocol')

  if (recorder !== first) {
    fail(name, 'the import did not return the recorder from the first copy')
  }

  pass(name)
}

function checkGenerator() {
  const name = 'generator: readGenerator() names @describe-me/vitest and its version'
  const manifest = JSON.parse(
    readFileSync(new URL('../packages/vitest/package.json', import.meta.url), 'utf8'),
  )

  const expected = { name: manifest.name, version: manifest.version }
  const actual = readGenerator()

  if (!isDeepStrictEqual(actual, expected)) {
    fail(name, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  }

  pass(name)
}

const first = await checkFresh()
const expected = first.protocol

await checkSameProtocol(first)

await expectAccepted('0.5.0 recorder: accepted without a protocol', 'recorder-0-5-0', {
  flush() {},
  beforeInteraction() {},
  configure() {},
})

await expectRejected(
  '0.4 recorder: rejected',
  'recorder-0-4',
  { begin() {}, capture() {}, end() {} },
  [SAME_VERSION, 'protocol none'],
)

await expectRejected(
  'newer protocol: rejected',
  'newer-protocol',
  { protocol: expected + 1, flush() {} },
  [SAME_VERSION, `protocol ${expected + 1}`],
)

checkGenerator()
