/**
 * Checks `sidebar.groups` on the built plugin and reporter. `validateSidebar`
 * must accept no option, `{}` and `{ groups: {} }` as no groups, and throw a
 * `describe-me: sidebar…` error for every malformed shape: a `sidebar` or
 * `groups` that is not an object, an unknown key, an empty key or group name,
 * a bad glob value, two `*` segments, and a glob of a `*` key without a
 * segment that is exactly `*`, before any `**` and not the last. The
 * reporter's constructor and the plugin's `config()` must throw it too.
 * `sidebarGroups` must give each file the group of the first key that matches
 * it, name a `*` segment after the folder its glob matched, list the groups
 * depth first in the order the config first names them, `*` groups by name,
 * leave out groups without files, and warn once per key that gets no file,
 * naming the earlier keys that took its files. The reporter, driven without a
 * real Vitest on a temp root whose previous manifest holds every module, must
 * group them all without a false warning, write the warnings to
 * `setupWarnings` and print them, and drop a stale `group` and `sidebar` when
 * the option no longer gives them. Run after `pnpm build`. Exits 1 on any
 * failure.
 *
 * Usage: `node scripts/check-sidebar-groups.mjs`
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { describeMe } from '../packages/vitest/dist/plugin.js'
import DescribeMeReporter from '../packages/vitest/dist/reporter.js'
import { sidebarGroups } from '../packages/vitest/dist/sidebar-groups.js'
import { validateSidebar } from '../packages/vitest/dist/validate-sidebar.js'

const directories = []
let checks = 0
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
  checks++

  if (passed) {
    console.log(`ok    ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail === undefined ? '' : ` (${detail})`}`)
  }
}

function same(actual, expected) {
  return {
    passed: isDeepStrictEqual(actual, expected),
    detail: `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  }
}

function throwsWith(run, prefix) {
  try {
    run()
  } catch (error) {
    const message = errorMessage(error)

    return { passed: message.startsWith(prefix), detail: message }
  }

  return { passed: false, detail: 'did not throw' }
}

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-sidebar-'))
  directories.push(dir)

  return dir
}

function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  }
}

/** Groups the files under `groups`, as the reporter does. */
function grouped(groups, files) {
  const modules = files.map((id) => ({ id, tests: [] }))

  return sidebarGroups(modules, validateSidebar({ groups }))
}

/** Each file's group, `null` for one without. */
function groupsOfFiles(result) {
  return Object.fromEntries(result.modules.map((mod) => [mod.id, mod.group ?? null]))
}

// ---------- the option ----------

async function checkValidShapes() {
  for (const [label, value] of [
    ['no option', undefined],
    ['{}', {}],
    ['{ groups: {} }', { groups: {} }],
    ['{ groups: undefined }', { groups: undefined }],
  ]) {
    await check(`${label} gives no groups and no warnings`, () => {
      const option = validateSidebar(value)
      const result = sidebarGroups([{ id: 'src/A.test.tsx', tests: [] }], option)

      return same(
        { rules: option.groups, result },
        {
          rules: [],
          result: { modules: [{ id: 'src/A.test.tsx', tests: [] }], groups: [], warnings: [] },
        },
      )
    })
  }

  await check('an object without a prototype is a plain object', () =>
    same(
      validateSidebar(Object.assign(Object.create(null), { groups: { A: 'a/**' } })).groups.map(
        (rule) => rule.key,
      ),
      ['A'],
    ),
  )

  await check('a key is trimmed per level, and a segment that only contains * is literal', () =>
    same(
      validateSidebar({ groups: { ' Docs / Guides ': 'a/**', 'Wild*card': 'b/**' } }).groups.map(
        (rule) => ({ segments: rule.segments, placeholder: rule.placeholder }),
      ),
      [
        { segments: ['Docs', 'Guides'], placeholder: null },
        { segments: ['Wild*card'], placeholder: null },
      ],
    ),
  )
}

async function checkErrors() {
  const cases = [
    [true, 'describe-me: sidebar must be an object such as { groups }, got true'],
    ['groups', "describe-me: sidebar must be an object such as { groups }, got 'groups'"],
    [[], 'describe-me: sidebar must be an object such as { groups }, got []'],
    [null, 'describe-me: sidebar must be an object such as { groups }, got null'],
    [{ group: {} }, 'describe-me: sidebar.group is not an option. sidebar takes groups.'],
    [
      { groups: {}, order: 'alpha' },
      'describe-me: sidebar.order is not an option. sidebar takes groups.',
    ],
    [
      { groups: [] },
      'describe-me: sidebar.groups must be an object of group paths and globs, got []',
    ],
    [
      { groups: null },
      'describe-me: sidebar.groups must be an object of group paths and globs, got null',
    ],
    [
      { groups: 'src/**' },
      "describe-me: sidebar.groups must be an object of group paths and globs, got 'src/**'",
    ],
    [{ groups: { '': 'a/**' } }, "describe-me: sidebar.groups key '' is empty."],
    [{ groups: { '  ': 'a/**' } }, "describe-me: sidebar.groups key '  ' is empty."],
  ]

  for (const key of ['A//B', '/A', 'A/', 'A/ /B']) {
    cases.push([
      { groups: { [key]: 'a/**' } },
      `describe-me: sidebar.groups key '${key}' has an empty group name.`,
    ])
  }

  for (const [value, shown] of [
    ['', "''"],
    [[], '[]'],
    [['a/**', ''], "[ 'a/**', '' ]"],
    [1, '1'],
    [null, 'null'],
    [['a/**', 2], "[ 'a/**', 2 ]"],
  ]) {
    cases.push([
      { groups: { Forms: value } },
      `describe-me: sidebar.groups['Forms'] expects a non-empty glob string or a non-empty list of them, got ${shown}`,
    ])
  }

  cases.push([
    { groups: { 'A/*/*': 'src/*/*/**' } },
    "describe-me: sidebar.groups key 'A/*/*' has more than one * segment",
  ])

  for (const glob of ['src/**', 'src/**/*/x.test.tsx', 'src/features/*', 'src/feat*/**']) {
    cases.push([
      { groups: { 'Features/*': glob } },
      `describe-me: sidebar.groups['Features/*'] names its groups after a * segment, so the glob '${glob}' needs a segment that is exactly *, before any ** and not the last`,
    ])
  }

  cases.push([
    { groups: { 'Features/*': ['src/features/*/**', 'lib/**'] } },
    "describe-me: sidebar.groups['Features/*'] names its groups after a * segment, so the glob 'lib/**'",
  ])

  for (const [value, prefix] of cases) {
    await check(`validateSidebar throws for ${JSON.stringify(value)}`, () =>
      throwsWith(() => validateSidebar(value), prefix),
    )
  }
}

async function checkWhereItRuns() {
  await check('the reporter checks the option in its constructor', () =>
    throwsWith(
      () => new DescribeMeReporter({ sidebar: { groups: { Forms: [] } } }),
      "describe-me: sidebar.groups['Forms']",
    ),
  )

  await check('the plugin rejects a bad option in config(), before any test', async () => {
    try {
      await describeMe({ sidebar: { groups: { 'A/*': 'src/**' } } }).config({
        root: tempDir(),
        test: {},
      })
    } catch (error) {
      const message = errorMessage(error)

      return { passed: message.startsWith("describe-me: sidebar.groups['A/*']"), detail: message }
    }

    return { passed: false, detail: 'did not throw' }
  })

  await check('the plugin accepts a good option in config()', async () => {
    const config = await describeMe({ sidebar: { groups: { A: 'src/**' } } }).config({
      root: tempDir(),
      test: {},
    })

    return Array.isArray(config.test?.reporters)
  })
}

// ---------- matching ----------

async function checkFirstMatch() {
  await check('a narrower key above a broader one takes its files', () =>
    same(
      groupsOfFiles(
        grouped(
          {
            'Components/Forms': 'src/components/{Input,Select}/**',
            Components: 'src/components/**',
          },
          [
            'src/App.test.tsx',
            'src/components/Button/Button.test.tsx',
            'src/components/Input/Input.test.tsx',
            'src/components/Select/Select.test.tsx',
          ],
        ),
      ),
      {
        'src/App.test.tsx': null,
        'src/components/Button/Button.test.tsx': ['Components'],
        'src/components/Input/Input.test.tsx': ['Components', 'Forms'],
        'src/components/Select/Select.test.tsx': ['Components', 'Forms'],
      },
    ),
  )

  await check('a file that matches no key has no group field', () => {
    const [mod] = grouped({ A: 'src/a/**' }, ['src/App.test.tsx']).modules

    return same(mod, { id: 'src/App.test.tsx', tests: [] })
  })

  await check('globs match dotfiles, a leading ./ and a list', () =>
    same(
      groupsOfFiles(
        grouped({ Hidden: './src/.internal/**', Pair: ['lib/**', 'src/pair/**'] }, [
          'src/.internal/Debug.test.tsx',
          'src/pair/Pair.test.tsx',
        ]),
      ),
      { 'src/.internal/Debug.test.tsx': ['Hidden'], 'src/pair/Pair.test.tsx': ['Pair'] },
    ),
  )
}

async function checkCapture() {
  const files = [
    'src/features/checkout/Cart.test.tsx',
    'src/features/checkout/ui/Total.test.tsx',
    'src/features/Cart.test.tsx',
  ]

  const expected = {
    'src/features/checkout/Cart.test.tsx': ['Features', 'checkout'],
    'src/features/checkout/ui/Total.test.tsx': ['Features', 'checkout'],
    'src/features/Cart.test.tsx': null,
  }

  await check('a * segment takes the folder name, and a file right in the folder gets none', () =>
    same(groupsOfFiles(grouped({ 'Features/*': 'src/features/*/**' }, files)), expected),
  )

  await check('a ./ glob captures the same folder', () =>
    same(groupsOfFiles(grouped({ 'Features/*': './src/features/*/**' }, files)), expected),
  )

  await check('a segment after * in the key follows the captured name', () =>
    same(
      groupsOfFiles(
        grouped({ 'Features/*/Pages': 'src/features/*/pages/**' }, [
          'src/features/checkout/pages/Cart.test.tsx',
          'src/features/checkout/Cart.test.tsx',
        ]),
      ),
      {
        'src/features/checkout/pages/Cart.test.tsx': ['Features', 'checkout', 'Pages'],
        'src/features/checkout/Cart.test.tsx': null,
      },
    ),
  )

  await check('in a list, the glob that matches gives the name', () =>
    same(
      groupsOfFiles(
        grouped({ 'Packages/*': ['libs/*/src/**', 'packages/*/src/**'] }, [
          'packages/ui/src/Button.test.tsx',
        ]),
      ),
      { 'packages/ui/src/Button.test.tsx': ['Packages', 'ui'] },
    ),
  )

  await check('a capture segment first in the glob takes the first folder', () =>
    same(
      groupsOfFiles(
        grouped({ '*/Tests': '*/tests/**' }, ['app/tests/a.test.ts', 'app/b/tests/c.test.ts']),
      ),
      { 'app/tests/a.test.ts': ['app', 'Tests'], 'app/b/tests/c.test.ts': null },
    ),
  )
}

// ---------- order ----------

async function checkOrder() {
  await check('a parent comes before its subgroups', () =>
    same(grouped({ 'A/B': 'a/b/**', A: 'a/**' }, ['a/x.test.ts', 'a/b/y.test.ts']).groups, [
      ['A'],
      ['A', 'B'],
    ]),
  )

  await check('a parent without files of its own is listed for its subgroup', () =>
    same(grouped({ 'A/B': 'a/b/**' }, ['a/b/y.test.ts']).groups, [['A'], ['A', 'B']]),
  )

  await check('siblings keep the order the config first names them in', () =>
    same(
      grouped({ 'Zeta/Sub': 'z/sub/**', Alpha: 'a/**', Zeta: 'z/**' }, [
        'a/x.test.ts',
        'z/sub/y.test.ts',
        'z/w.test.ts',
      ]).groups,
      [['Zeta'], ['Zeta', 'Sub'], ['Alpha']],
    ),
  )

  await check('a parent named first by a literal key without files keeps its place', () =>
    same(
      grouped({ Docs: 'none/**', Zeta: 'z/**', 'Docs/Guides': 'docs/guides/**' }, [
        'z/x.test.ts',
        'docs/guides/y.test.ts',
      ]).groups,
      [['Docs'], ['Docs', 'Guides'], ['Zeta']],
    ),
  )

  await check('a parent named first by a * key without files keeps its place', () =>
    same(
      grouped({ 'Features/*': 'none/*/**', Zeta: 'z/**', 'Features/Extra': 'extra/**' }, [
        'z/x.test.ts',
        'extra/y.test.ts',
      ]).groups,
      [['Features'], ['Features', 'Extra'], ['Zeta']],
    ),
  )

  await check('* groups come in alphabetical order, case aside', () =>
    same(
      grouped({ 'Features/*': 'src/*/**' }, [
        'src/checkout/a.test.ts',
        'src/Billing/b.test.ts',
        'src/auth/c.test.ts',
      ]).groups,
      [['Features'], ['Features', 'auth'], ['Features', 'Billing'], ['Features', 'checkout']],
    ),
  )

  await check('a literal key and a * key with the same path merge', () => {
    const result = grouped({ 'Features/auth': 'src/auth/**', 'Features/*': 'src/features/*/**' }, [
      'src/auth/Login.test.tsx',
      'src/features/auth/Session.test.tsx',
    ])

    return same(
      { groups: result.groups, files: groupsOfFiles(result), warnings: result.warnings },
      {
        groups: [['Features'], ['Features', 'auth']],
        files: {
          'src/auth/Login.test.tsx': ['Features', 'auth'],
          'src/features/auth/Session.test.tsx': ['Features', 'auth'],
        },
        warnings: [],
      },
    )
  })

  await check('groups without files are left out', () =>
    same(
      grouped({ Empty: 'none/**', 'A/B': 'none/**', A: 'a/**', 'C/*': 'none/*/**' }, [
        'a/x.test.ts',
      ]).groups,
      [['A']],
    ),
  )

  await check('the example of configuration.html', () =>
    same(
      grouped(
        {
          Foundations: 'src/tokens/**',
          'Components/Forms': 'src/components/{Input,Select,Checkbox}/**',
          Components: 'src/components/**',
          'Features/*': 'src/features/*/**',
        },
        [
          'src/components/Button/Button.test.tsx',
          'src/components/Input/Input.test.tsx',
          'src/features/auth/Login.test.tsx',
          'src/features/checkout/Cart.test.tsx',
          'src/tokens/Colors.test.tsx',
        ],
      ).groups,
      [
        ['Foundations'],
        ['Components'],
        ['Components', 'Forms'],
        ['Features'],
        ['Features', 'auth'],
        ['Features', 'checkout'],
      ],
    ),
  )
}

// ---------- warnings ----------

async function checkWarnings() {
  await check('a key that matches nothing gives one warning', () =>
    same(grouped({ A: 'a/**', Nothing: 'none/**' }, ['a/x.test.ts']).warnings, [
      "sidebar.groups['Nothing'] matches no recorded test file, so the group stays empty.",
    ]),
  )

  await check('a key whose files an earlier key takes names that key', () =>
    same(
      grouped({ Components: 'src/**', 'Components/Forms': 'src/{Input,Select}.test.tsx' }, [
        'src/Input.test.tsx',
        'src/Select.test.tsx',
      ]).warnings,
      [
        "sidebar.groups['Components/Forms'] gets no test file, because an earlier key takes the 2 files it matches: 'Components'. Move it above that key or narrow that key's globs.",
      ],
    ),
  )

  await check('a key whose files earlier keys take names them in config order', () =>
    same(
      grouped({ B: 'src/b/**', A: 'src/a/**', Unused: 'none/**', Late: 'src/*/Form*.test.tsx' }, [
        'src/a/Form1.test.tsx',
        'src/b/Form2.test.tsx',
      ]).warnings,
      [
        "sidebar.groups['Unused'] matches no recorded test file, so the group stays empty.",
        "sidebar.groups['Late'] gets no test file, because earlier keys take the 2 files it matches: 'B', 'A'. Move it above them or narrow their globs.",
      ],
    ),
  )

  await check('a * key that matches one taken file names the file once', () =>
    same(grouped({ All: 'src/**', 'Features/*': 'src/*/**' }, ['src/a/x.test.ts']).warnings, [
      "sidebar.groups['Features/*'] gets no test file, because an earlier key takes the file it matches: 'All'. Move it above that key or narrow that key's globs.",
    ]),
  )

  await check('keys that all get files give no warning', () =>
    same(grouped({ A: 'a/**', 'B/*': 'b/*/**' }, ['a/x.test.ts', 'b/c/y.test.ts']).warnings, []),
  )
}

// ---------- the reporter ----------

const TEST_FILES = [
  'src/components/Button.test.tsx',
  'src/components/Input.test.tsx',
  'src/App.test.tsx',
]

function previousTest(file) {
  return {
    id: `${String(TEST_FILES.indexOf(file)).padStart(12, '0')}`,
    vitestId: `${file}_0`,
    name: 'renders',
    path: [],
    fullName: 'renders',
    state: 'passed',
    frames: [
      { id: 'f0', kind: 'render', label: 'render', at: 0, snapshot: 'snapshots/missing.json' },
    ],
  }
}

/** A temp root with the test files and a previous manifest that holds all of them. */
function projectRoot(previous = {}) {
  const root = tempDir()
  const files = Object.fromEntries(TEST_FILES.map((file) => [file, '']))

  writeFiles(root, {
    ...files,
    '.describe-me/manifest.json': {
      version: 1,
      generatedAt: new Date(0).toISOString(),
      root,
      modules: TEST_FILES.map((id) => ({
        id,
        ...previous.groups?.[id],
        tests: [previousTest(id)],
      })),
      ...(previous.sidebar ? { sidebar: previous.sidebar } : {}),
      components: {},
    },
  })

  return root
}

async function reporterRun(root, options) {
  const warned = []
  const { warn, info } = console
  console.warn = (...args) => warned.push(args.join(' '))
  console.info = () => {}

  try {
    const reporter = new DescribeMeReporter({ foundations: false, ...options })
    reporter.onInit({ config: { root } })
    reporter.onTestRunStart()
    await reporter.onTestRunEnd()
  } finally {
    console.warn = warn
    console.info = info
  }

  const manifest = JSON.parse(readFileSync(join(root, '.describe-me/manifest.json'), 'utf8'))

  return { manifest, warned }
}

function modulesOf(manifest) {
  return manifest.modules.map((mod) => ({ id: mod.id, group: mod.group ?? null }))
}

async function checkReporter() {
  for (const [label, sidebar] of [
    ['without the option', undefined],
    ['with {}', {}],
    ['with { groups: {} }', { groups: {} }],
  ]) {
    await check(`the reporter ${label} writes no group, no sidebar and no warning`, async () => {
      const { manifest } = await reporterRun(projectRoot(), { sidebar })

      return same(
        {
          sidebar: 'sidebar' in manifest,
          group: manifest.modules.some((mod) => 'group' in mod),
          setupWarnings: 'setupWarnings' in manifest,
        },
        { sidebar: false, group: false, setupWarnings: false },
      )
    })
  }

  await check(
    'a run of modules that all come from the last run groups them without a warning',
    async () => {
      const { manifest, warned } = await reporterRun(projectRoot(), {
        sidebar: {
          groups: { 'Components/Forms': 'src/components/Input*', Components: 'src/components/**' },
        },
      })

      return same(
        {
          modules: modulesOf(manifest),
          sidebar: manifest.sidebar,
          setupWarnings: manifest.setupWarnings,
          warned,
        },
        {
          modules: [
            { id: 'src/App.test.tsx', group: null },
            { id: 'src/components/Button.test.tsx', group: ['Components'] },
            { id: 'src/components/Input.test.tsx', group: ['Components', 'Forms'] },
          ],
          sidebar: { groups: [['Components'], ['Components', 'Forms']] },
          setupWarnings: undefined,
          warned: [],
        },
      )
    },
  )

  await check(
    "the reporter writes a group warning after the plugin's and prints both",
    async () => {
      const empty =
        "sidebar.groups['Pages'] matches no recorded test file, so the group stays empty."

      const { manifest, warned } = await reporterRun(projectRoot(), {
        setupWarnings: ['a warning of the plugin.'],
        sidebar: { groups: { Components: 'src/components/**', Pages: 'src/pages/**' } },
      })

      return same(
        { setupWarnings: manifest.setupWarnings, warned },
        {
          setupWarnings: ['a warning of the plugin.', empty],
          warned: ['describe-me: a warning of the plugin.', `describe-me: ${empty}`],
        },
      )
    },
  )

  const stale = {
    groups: {
      'src/components/Button.test.tsx': { group: ['Old'] },
      'src/App.test.tsx': { group: ['Old', 'App'] },
    },
    sidebar: { groups: [['Old'], ['Old', 'App']] },
  }

  await check('a rerun without the option drops a stale group and sidebar', async () => {
    const { manifest } = await reporterRun(projectRoot(stale), {})

    return same(
      { sidebar: 'sidebar' in manifest, group: manifest.modules.some((mod) => 'group' in mod) },
      { sidebar: false, group: false },
    )
  })

  await check('a rerun with other groups drops the stale ones', async () => {
    const { manifest } = await reporterRun(projectRoot(stale), {
      sidebar: { groups: { Inputs: 'src/components/Input*' } },
    })

    return same(
      { modules: modulesOf(manifest), sidebar: manifest.sidebar },
      {
        modules: [
          { id: 'src/App.test.tsx', group: null },
          { id: 'src/components/Button.test.tsx', group: null },
          { id: 'src/components/Input.test.tsx', group: ['Inputs'] },
        ],
        sidebar: { groups: [['Inputs']] },
      },
    )
  })
}

try {
  await checkValidShapes()
  await checkErrors()
  await checkWhereItRuns()
  await checkFirstMatch()
  await checkCapture()
  await checkOrder()
  await checkWarnings()
  await checkReporter()
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-sidebar-groups: ${failures} of ${checks} checks failed`)
  process.exit(1)
}

console.log(`check-sidebar-groups: all ${checks} checks passed`)
