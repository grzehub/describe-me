/**
 * Checks which tests become stories under the `stories` option and the `docs`
 * and `no-docs` tags. On the built output of @describe-me/vitest it checks the
 * tag rule, the option's validation, the tag definitions the plugin adds and
 * the Vitest version check. Then it runs `examples/react-jsdom/stories/` with
 * `stories: 'all'` and `'tagged'`, and filtered, where the manifest must drop
 * what the last run kept and the current tags or option no longer select, and
 * give the tests it keeps their current tags. Run after `pnpm build`. Exits 1
 * on the first mismatch.
 *
 * Usage: `node scripts/check-stories.mjs`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { checkTagsSupported } from '../packages/vitest/dist/check-tags-supported.js'
import { docsTagDefinitions } from '../packages/vitest/dist/docs-tag-definitions.js'
import { stableTestId } from '../packages/vitest/dist/stable-test-id.js'
import { tagFilter } from '../packages/vitest/dist/tag-filter.js'
import { validateStories } from '../packages/vitest/dist/validate-stories.js'

const EXAMPLE = fileURLToPath(new URL('../examples/react-jsdom/', import.meta.url))
const MANIFEST = join(EXAMPLE, 'node_modules/.describe-me-stories/manifest.json')

const TAGGED = [
  'stories/module-tag.test.tsx > inherits docs from its file',
  'stories/tagged.test.tsx > carries docs itself',
  'stories/tagged.test.tsx > tagged suite > inherits docs from its suite',
]

const ALL = [
  ...TAGGED,
  'stories/tagged.test.tsx > has no tag',
  'stories/untagged.test.tsx > lives in a file without tags',
].sort()

/** The tags each story of `ALL` carries in the fixtures. */
const CURRENT_TAGS = {
  'stories/module-tag.test.tsx > inherits docs from its file': ['docs'],
  'stories/tagged.test.tsx > carries docs itself': ['docs'],
  'stories/tagged.test.tsx > tagged suite > inherits docs from its suite': ['docs'],
  'stories/tagged.test.tsx > has no tag': [],
  'stories/untagged.test.tsx > lives in a file without tags': [],
}

function fail(name, detail, notes = []) {
  console.error(`FAIL  ${name} (${detail})`)

  for (const note of notes) {
    console.error(`      ${note}`)
  }

  console.error('check-stories: stopped at the first mismatch')
  process.exit(1)
}

function pass(name) {
  console.log(`ok    ${name}`)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function expectEqual(name, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(name, 'unexpected value', [
      `expected ${JSON.stringify(expected)}`,
      `got      ${JSON.stringify(actual)}`,
    ])
  }

  pass(name)
}

function expectThrows(name, run, pattern) {
  try {
    run()
  } catch (error) {
    if (!pattern.test(errorMessage(error))) {
      fail(name, 'wrong error', [errorMessage(error)])
    }

    pass(name)
    return
  }

  fail(name, 'did not throw')
}

function checkTagRule() {
  const all = tagFilter('all')
  const tagged = tagFilter('tagged')
  const cases = [[], ['docs'], ['no-docs'], ['docs', 'no-docs'], ['other']]

  expectEqual(
    "tag rule, stories: 'all'",
    cases.map((tags) => all(tags)),
    [true, true, false, false, true],
  )

  expectEqual(
    "tag rule, stories: 'tagged'",
    cases.map((tags) => tagged(tags)),
    [false, true, false, false, false],
  )
}

function checkValidation() {
  expectEqual('stories defaults to all', validateStories(undefined), 'all')
  expectEqual('stories accepts tagged', validateStories('tagged'), 'tagged')
  expectThrows(
    'stories rejects other values',
    () => validateStories('docs'),
    /^describe-me: stories expects/,
  )
}

function checkTagDefinitions() {
  expectEqual(
    'the plugin defines both tags',
    docsTagDefinitions({}).map((tag) => tag.name),
    ['docs', 'no-docs'],
  )

  expectEqual(
    'the plugin leaves a tag the user defines',
    docsTagDefinitions({ test: { tags: [{ name: 'docs' }] } }).map((tag) => tag.name),
    ['no-docs'],
  )
}

/** A project root whose `vitest` reports `version`. */
function fakeRoot(version) {
  const root = mkdtempSync(join(tmpdir(), 'describe-me-stories-'))
  const vitest = join(root, 'node_modules/vitest')

  mkdirSync(vitest, { recursive: true })
  writeFileSync(join(root, 'package.json'), '{}')
  writeFileSync(
    join(vitest, 'package.json'),
    JSON.stringify({ name: 'vitest', version, exports: { './package.json': './package.json' } }),
  )

  return root
}

function checkVersion() {
  const roots = { old: fakeRoot('4.0.18'), tags: fakeRoot('4.1.0') }

  try {
    expectThrows(
      "stories: 'tagged' fails on Vitest 4.0",
      () => checkTagsSupported('tagged', roots.old),
      /arrived in Vitest 4\.1\. This project resolves Vitest 4\.0\./,
    )

    expectEqual(
      "stories: 'all' passes on Vitest 4.0",
      checkTagsSupported('all', roots.old),
      undefined,
    )

    expectEqual(
      "stories: 'tagged' passes on Vitest 4.1",
      checkTagsSupported('tagged', roots.tags),
      undefined,
    )
  } finally {
    for (const root of Object.values(roots)) {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

function runVitest(stories, args = []) {
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...args], {
    cwd: EXAMPLE,
    env: { ...process.env, STORIES: stories },
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    fail(`vitest, stories: '${stories}'`, `exit ${result.status}`, [result.stdout, result.stderr])
  }
}

/** Every test of the manifest as `<module> > <full name>`, sorted. */
function manifestTests() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

  return manifest.modules
    .flatMap((mod) => mod.tests.map((test) => `${mod.id} > ${test.fullName}`))
    .sort()
}

/** The tags of every test of the manifest, by `<module> > <full name>`. */
function manifestTags() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

  return Object.fromEntries(
    manifest.modules.flatMap((mod) =>
      mod.tests.map((test) => [`${mod.id} > ${test.fullName}`, test.tags ?? []]),
    ),
  )
}

/** Gives every test of the manifest the tag `stale`, as a run before a retag would have left it. */
function staleTags() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

  for (const test of manifest.modules.flatMap((mod) => mod.tests)) {
    test.tags = ['stale']
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
}

/**
 * Gives the manifest an entry for the `no-docs` test of tagged.test.tsx, as a
 * run from before it was tagged would have left it, with the frames of
 * another test of the file.
 */
function addUntaggedEntry() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const mod = manifest.modules.find((candidate) => candidate.id === 'stories/tagged.test.tsx')
  const donor = mod.tests.find((test) => test.name === 'has no tag')
  const path = ['tagged suite']
  const name = 'opts out with no-docs'

  mod.tests.push({
    ...donor,
    id: stableTestId(mod.id, path, name, 1),
    name,
    path,
    fullName: `${path[0]} > ${name}`,
  })

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
}

function checkRuns() {
  rmSync(MANIFEST, { force: true })

  runVitest('all')
  expectEqual("stories: 'all' leaves out no-docs", manifestTests(), ALL)

  runVitest('tagged', ['stories/module-tag.test.tsx'])
  expectEqual(
    "a filtered run with stories: 'tagged' drops what the last run kept untagged",
    manifestTests(),
    TAGGED,
  )

  runVitest('all')
  runVitest('all', ['-t', 'has no tag'])
  expectEqual('a run filtered by name keeps the skipped stories', manifestTests(), ALL)

  staleTags()
  runVitest('all', ['-t', 'has no tag'])
  expectEqual(
    'a run filtered by name gives the skipped stories their current tags',
    manifestTags(),
    CURRENT_TAGS,
  )

  addUntaggedEntry()
  runVitest('all', ['-t', 'has no tag'])
  expectEqual(
    'a run filtered by name drops a skipped test tagged no-docs since the last run',
    manifestTests(),
    ALL,
  )

  runVitest('tagged')
  expectEqual("stories: 'tagged' keeps only docs", manifestTests(), TAGGED)
}

checkTagRule()
checkValidation()
checkTagDefinitions()
checkVersion()
checkRuns()
console.log('check-stories: ok')
