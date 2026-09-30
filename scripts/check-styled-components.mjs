/**
 * Checks how @describe-me/vitest points the browser build of styled-components
 * at tslib, on its built output. Every case builds a small `node_modules` tree.
 * styled-components 6.0 to 6.3 get a `/^tslib$/` alias to the `tslib.es6.mjs`
 * of the tslib they resolve. A tslib without that file gives a setup warning
 * instead, and later versions leave tslib alone. The plugin must hand the
 * warning to the reporter, which writes it to the manifest and prints it.
 * Run after `pnpm build`.
 *
 * Usage: `node scripts/check-styled-components.mjs`
 */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'
import { describeMe } from '../packages/vitest/dist/plugin.js'
import { styledComponentsBrowserBuild } from '../packages/vitest/dist/styled-components-browser-build.js'

const BROWSER_FILE = 'dist/styled-components.browser.esm.js'
const STYLED_ALIAS = `/^styled-components$/ → node_modules/styled-components/${BROWSER_FILE}`
const OPTIMIZER = {
  deps: { optimizer: { client: { enabled: true, include: ['styled-components'] } } },
}

const directories = []
let failures = 0

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** `run` returns a boolean or `{ passed, detail }`, or a promise of one. Throwing fails. */
async function check(name, run) {
  let outcome
  try {
    outcome = await run()
  } catch (error) {
    outcome = { passed: false, detail: `threw: ${errorMessage(error)}` }
  }

  const { passed, detail } = typeof outcome === 'boolean' ? { passed: outcome } : outcome
  const suffix = detail ? ` (${detail})` : ''
  if (!passed) {
    failures++
  }

  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${name}${suffix}`)
}

function same(actual, expected) {
  const passed = isDeepStrictEqual(actual, expected)

  return passed ? true : { passed, detail: `got ${JSON.stringify(actual)}` }
}

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeTslib(dir, { version, mjs }) {
  writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'tslib', version }))

  if (mjs) {
    writeFile(join(dir, 'tslib.es6.mjs'), 'export {}\n')
  }
}

/**
 * A project with styled-components and, optionally, a tslib at the root and
 * one nested inside styled-components. The root is a real path, because Node
 * resolves through the `/var` symlink on macOS.
 */
function fixture({ version, tslibRange, rootTslib, nestedTslib }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'describe-me-styled-')))
  const styledComponents = join(root, 'node_modules', 'styled-components')
  directories.push(root)

  const manifest = {
    name: 'styled-components',
    version,
    module: 'dist/styled-components.esm.js',
    browser: { './dist/styled-components.esm.js': `./${BROWSER_FILE}` },
  }

  if (tslibRange) {
    manifest.dependencies = { tslib: tslibRange }
  }

  writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true }))
  writeFile(join(styledComponents, 'package.json'), JSON.stringify(manifest))
  writeFile(join(styledComponents, BROWSER_FILE), '')

  if (rootTslib) {
    writeTslib(join(root, 'node_modules', 'tslib'), rootTslib)
  }

  if (nestedTslib) {
    writeTslib(join(styledComponents, 'node_modules', 'tslib'), nestedTslib)
  }

  return root
}

/** Aliases as `find → path relative to the root`, which reads well in a failure. */
function aliasesOf(config, root) {
  const aliases = config?.resolve?.alias ?? []

  return aliases.map((alias) => `${alias.find} → ${relative(root, alias.replacement)}`)
}

/** The browser build's aliases and warning, and whether it kept the optimizer. */
function browserBuildOf(root) {
  const build = styledComponentsBrowserBuild(root)

  return {
    aliases: aliasesOf(build?.config, root),
    optimizer: isDeepStrictEqual(build?.config.test, OPTIMIZER),
    warning: build?.warning,
  }
}

function hasTslibAlias(config) {
  const aliases = config.resolve?.alias ?? []

  return aliases.some((alias) => String(alias.find) === '/^tslib$/')
}

/**
 * Runs the reporter the plugin creates for `root` over an empty run. Returns
 * the plugin's config, the manifest the reporter wrote and what it warned.
 */
async function pluginRun(root, options) {
  const warned = []
  const { warn, info } = console
  console.warn = (...args) => warned.push(args.join(' '))
  console.info = () => {}
  let config

  try {
    config = describeMe(options).config({ root, test: {} })
    const reporter = config.test.reporters.find((candidate) => typeof candidate === 'object')
    reporter.onInit({ config: { root } })
    reporter.onTestRunStart()
    await reporter.onTestRunEnd()
  } finally {
    console.warn = warn
    console.info = info
  }

  const manifest = JSON.parse(readFileSync(join(root, options.outDir, 'manifest.json'), 'utf8'))

  return { config, manifest, warned }
}

async function checkCurrent(current) {
  await check('a. 6.3.12 with tslib 2.8.1: tslib aliased to its tslib.es6.mjs, no warning', () =>
    same(browserBuildOf(current), {
      aliases: [STYLED_ALIAS, '/^tslib$/ → node_modules/tslib/tslib.es6.mjs'],
      optimizer: true,
      warning: undefined,
    }),
  )
}

async function checkNested(nested) {
  await check('b. the nested tslib 2.6.2 wins over the root tslib 1.14.1', () =>
    same(browserBuildOf(nested).aliases, [
      STYLED_ALIAS,
      '/^tslib$/ → node_modules/styled-components/node_modules/tslib/tslib.es6.mjs',
    ]),
  )
}

async function checkOld(old) {
  const build = browserBuildOf(old)

  await check(
    'c. 6.1.9 with tslib 2.5.0: no tslib alias, styled-components alias and optimizer kept',
    () =>
      same(
        { aliases: build.aliases, optimizer: build.optimizer },
        { aliases: [STYLED_ALIAS], optimizer: true },
      ),
  )

  const missing = ['6.1.9', '2.5.0', 'tslib.es6.mjs', '6.1.10', '2.5.3'].filter(
    (part) => !build.warning?.includes(part),
  )

  await check('c. the warning names both versions, tslib.es6.mjs, 6.1.10 and 2.5.3', () =>
    missing.length === 0
      ? true
      : { passed: false, detail: `lacks ${missing.join(', ')}: ${build.warning}` },
  )

  return build.warning
}

async function checkLater(later) {
  await check(
    'd. 6.5.3 declares no tslib: no tslib alias and no warning, despite a root tslib',
    () =>
      same(browserBuildOf(later), { aliases: [STYLED_ALIAS], optimizer: true, warning: undefined }),
  )
}

async function checkReporter(old, current, warning) {
  const { manifest, warned } = await pluginRun(old, { outDir: '.describe-me' })

  await check('e. the manifest holds exactly the warning', () =>
    same(manifest.setupWarnings, [warning]),
  )

  await check('e. manifestDiagnostics() returns it', () =>
    same(manifestDiagnostics(manifest).setupWarnings, [warning]),
  )

  await check('e. it is printed as one describe-me: line', () =>
    same(warned, [`describe-me: ${warning}`]),
  )

  const clean = await pluginRun(current, { outDir: '.describe-me' })

  await check('e. a run without a warning writes no setupWarnings field', () =>
    same('setupWarnings' in clean.manifest, false),
  )
}

async function checkSwitchedOff(old) {
  const runs = [
    [
      'styledComponentsBrowserBuild: false',
      { outDir: '.describe-me-off', styledComponentsBrowserBuild: false },
    ],
    ["environment: 'browser'", { outDir: '.describe-me-browser', environment: 'browser' }],
  ]

  for (const [name, options] of runs) {
    const { config, manifest } = await pluginRun(old, options)

    await check(`f. ${name} gives no tslib alias and no setupWarnings`, () =>
      same(
        { alias: hasTslibAlias(config), field: 'setupWarnings' in manifest },
        { alias: false, field: false },
      ),
    )
  }
}

try {
  const current = fixture({
    version: '6.3.12',
    tslibRange: '2.8.1',
    rootTslib: { version: '2.8.1', mjs: true },
  })

  const nested = fixture({
    version: '6.2.0',
    tslibRange: '2.6.2',
    rootTslib: { version: '1.14.1', mjs: false },
    nestedTslib: { version: '2.6.2', mjs: true },
  })

  const old = fixture({
    version: '6.1.9',
    tslibRange: '2.5.0',
    rootTslib: { version: '2.5.0', mjs: false },
  })

  const later = fixture({ version: '6.5.3', rootTslib: { version: '2.8.1', mjs: true } })

  await checkCurrent(current)
  await checkNested(nested)
  const warning = await checkOld(old)
  await checkLater(later)
  await checkReporter(old, current, warning)
  await checkSwitchedOff(old)

  await check('g. a manifest without setupWarnings gives an empty list', () =>
    same(manifestDiagnostics({ modules: [], components: {} }).setupWarnings, []),
  )
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-styled-components: ${failures} failure(s)`)
  process.exit(1)
}

console.log('check-styled-components: ok')
