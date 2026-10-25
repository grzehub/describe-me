/**
 * Checks that the reporter's props reader, `collectComponentDocsSafely()` of
 * @describe-me/vitest, never stops a run, on its built output. Each case puts
 * a stand-in for `typescript` in front of the installed one and reads the
 * props of a small fixture project three times: with no rendered component,
 * then twice with one.
 *
 * - `installed`: the workspace's TypeScript 6 documents the fixture's
 *   `Button` with its literal values and default, and warns about nothing.
 * - `typescript-7`: a package shaped like TypeScript 7.0.2, whose main export
 *   holds only its version, gives no props and one warning that names it, on
 *   the first read with a component only.
 * - `missing`: a `typescript` that cannot be imported gives no props and the
 *   warning of a project without TypeScript, once.
 * - `broken`: a `typescript` with `createProgram` and nothing else, so the
 *   reader throws while it loads, gives no props and a warning on each read
 *   with a component.
 *
 * In every case the read without a rendered component returns no props,
 * warns about nothing and never resolves `typescript`. Run after
 * `pnpm build`. Needs `module.registerHooks()`, so Node 22.15 or later. Exits
 * 1 on the first failure.
 *
 * Usage: `node scripts/check-typescript.mjs`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const READ_PROPS = fileURLToPath(new URL('./check-typescript/read-props.mjs', import.meta.url))

const TYPESCRIPT_7 =
  'describe-me: typescript 7.0.2 has no compiler API that describe-me can use, component props will not be documented'

const MISSING = 'describe-me: typescript is not installed, component props will not be documented'
const UNREADABLE = 'describe-me: component props could not be read: '

/** What the installed TypeScript reads from the fixture's `Button`. */
const BUTTON_DOCS = {
  Button: {
    name: 'Button',
    file: 'src/Button.tsx',
    props: [
      {
        name: 'size',
        type: "'sm' | 'md'",
        required: false,
        defaultValue: "'md'",
        kind: 'literals',
        values: ["'sm'", "'md'"],
      },
    ],
  },
}

/** The files of the fixture, by their path in its directory. */
const FIXTURE_FILES = {
  'project/tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
  'project/src/Button.tsx': [
    "export function Button({ size = 'md' }: { size?: 'sm' | 'md' }): string {",
    '  return size',
    '}',
    '',
  ].join('\n'),
  'project/src/Button.test.tsx': "import { Button } from './Button'\n\nButton({})\n",
  // As TypeScript 7.0.2 publishes it: the main export holds the version and nothing else.
  'typescript-7/package.json': JSON.stringify({ name: 'typescript', version: '7.0.2' }),
  'typescript-7/lib/version.cjs': [
    "const { version } = require('../package.json')",
    'exports.version = version',
    "exports.versionMajorMinor = '7.0'",
    '',
  ].join('\n'),
  'typescript-broken/index.cjs': "exports.version = '6.0.0'\nexports.createProgram = () => {}\n",
}

const dir = mkdtempSync(join(tmpdir(), 'describe-me-typescript-'))

process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

function fail(name, detail) {
  console.error(`FAIL  ${name} (${detail})`)
  console.error('check-typescript: stopped at the first failure')
  process.exit(1)
}

function pass(name) {
  console.log(`ok    ${name}`)
}

function writeFixture() {
  for (const [path, text] of Object.entries(FIXTURE_FILES)) {
    const file = join(dir, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

/** The three reads of one case, each with its result, warnings and resolutions of `typescript`. */
function readProps(name, kind) {
  const child = spawnSync(process.execPath, [READ_PROPS, kind, dir], { encoding: 'utf8' })

  if (child.status !== 0) {
    fail(name, `read-props exited with ${child.status}: ${child.stderr.trim()}`)
  }

  const lines = child.stdout.trim().split('\n')

  return JSON.parse(lines[lines.length - 1])
}

function expectEqual(name, what, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(name, `${what} ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  }
}

/** The read without a rendered component costs nothing, whatever is installed. */
function expectFreeEmptyRead(name, read) {
  expectEqual(name, 'the read without a component gave', read.result, {})
  expectEqual(name, 'the read without a component warned', read.warnings, [])
  expectEqual(name, 'the read without a component resolved typescript', read.resolved, 0)
}

/** A case whose reads with a component give `result`, warning only on the first. */
function checkCase(name, kind, result, firstWarnings) {
  const [empty, first, second] = readProps(name, kind)

  expectFreeEmptyRead(name, empty)
  expectEqual(name, 'the first read gave', first.result, result)
  expectEqual(name, 'the first read warned', first.warnings, firstWarnings)
  expectEqual(name, 'the second read gave', second.result, result)
  expectEqual(name, 'the second read warned', second.warnings, [])
  pass(name)
}

function checkBroken() {
  const name = 'broken: no props, a warning on each read with a component'
  const [empty, ...reads] = readProps(name, 'broken')

  expectFreeEmptyRead(name, empty)

  for (const read of reads) {
    expectEqual(name, 'a read gave', read.result, {})

    const [warning, ...rest] = read.warnings

    if (warning === undefined || !warning.startsWith(UNREADABLE) || rest.length > 0) {
      fail(name, `a read warned ${JSON.stringify(read.warnings)}, expected one "${UNREADABLE}…"`)
    }
  }

  pass(name)
}

writeFixture()
checkCase('installed: TypeScript 6 documents Button', 'installed', BUTTON_DOCS, [])

checkCase('typescript-7: no props, one warning that names the version', 'typescript-7', {}, [
  TYPESCRIPT_7,
])

checkCase('missing: no props, the warning of a project without TypeScript', 'missing', {}, [
  MISSING,
])

checkBroken()
