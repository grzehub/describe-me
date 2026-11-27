/**
 * Checks `describe-me diff` on the built CLI, by spawning
 * `packages/viewer/dist-cli/main.js diff` on data directories written to a
 * temp dir and importing its modules for unit cases:
 *
 *  1. identical directories, and one directory as both sides: no test entry,
 *     `changes.md` is the marker and `Nothing changed against the base. N tests
 *     compared.` (`1 test` for one), exit 0
 *  2. one step added in the middle (`a b c` → `a x b c`): one added frame at
 *     head index 1, 3 unchanged frames, kind `dom`. One step removed (`a c`):
 *     one removed frame at base index 1. Two frames against one (`a y`): a
 *     `dom` change in order, then a removed frame.
 *  3. the same while the global stylesheet changed in every frame: 3 `css`
 *     pairs and 1 added frame
 *  4. a CSS-only change in an inline `_cssText`, in a `describe-me-style:`
 *     reference and in the text of a `<style>`: kind `css` each, listed inside
 *     `<details>` and not under `### Changed`
 *  5. a DOM change in a class attribute, in `data-describe-me-states` and in
 *     a `describe-me-asset:` URL: kind `dom` each
 *  6. other labels, `at`, `meta` and `duration` with the same snapshots: unchanged
 *  7. `passed` → `failed` with the same frames: `changed` with `state` and no
 *     `kind`, under `### Changed`
 *  8. a test added, one removed, one moved within its file and one moved to
 *     another file: one entry each, `from` on the moved ones, and an added and
 *     a removed test without frames do not pair
 *  9. props: the exact line for a changed default, and a `PropChange` and a
 *     line for a prop added, removed, with a new type, newly required, newly
 *     optional, with a default it did not have and without the one it had. A
 *     component on one side only and a changed description do not count. A
 *     manifest without `components`, in the base or in the head, counts as none.
 * 10. a base written before 0.5 (no `generator`, Vitest's ids, no `vitestId`,
 *     a repeated name, a module id with `\`) against a current head with the
 *     same tests: nothing added or removed, `versionsDiffer` and the version note
 * 11. two generator versions: `versionsDiffer` and the note. Equal versions:
 *     neither.
 * 12. errors, each exit 1 with stderr starting `describe-me: `: no `--base`, no
 *     manifest in the base and in the data directory, invalid JSON (without a
 *     piece of the file), a manifest that is not describe-me's, a missing
 *     snapshot file, a snapshot path outside the directory
 * 13. `--out` creates a missing directory, writes both files and keeps a file
 *     that was there. Without `--out`: no file written, a summary on stdout,
 *     which has the version note, the sections Changed, Props, Added, Removed
 *     and Moved, and the number of tests that changed only in CSS.
 * 14. length: thousands of changed tests, long names and many prop changes
 *     give `changes.md` of at most 65,536 characters (or the given limit),
 *     marker and sentence first, every list ending with `- and N more`
 * 15. Markdown safety: `@someone`, `#12`, `<img>`, `# heading`, backticks and a
 *     newline in a test name, and a component name that is no plain word,
 *     show only inside code spans
 * 16. `parseArgs`: `build` keeps `out` `describe-me-dist`, `diff --base x`
 *     gives no `out`. `--help`, and no command, print the `diff` line of the
 *     usage.
 * 17. examples/shadcn/.describe-me against itself: nothing changed
 * 18. examples/shadcn with SHADCN_CHANGED=1 passes, writes
 *     node_modules/.describe-me-changed/manifest.json and leaves the
 *     `generatedAt` of .describe-me/manifest.json alone. Another value fails.
 * 19. shadcn against its SHADCN_CHANGED=1 run: 16 changed, 10 `dom`, 6 `css`,
 *     nothing added, removed or moved, Card, SignupCard and Badge `dom`, every
 *     Input, Switch and Alert test `css`, and the new class only in the
 *     changed run
 *
 * Run after `pnpm build` and the shadcn example's tests. Exits 1 on any failure.
 *
 * Usage: `node scripts/check-diff.mjs`
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { codeSpans } from './check-diff/code-spans.mjs'
import { snapshot } from './check-diff/snapshot.mjs'
import { CURRENT, writeRun } from './check-diff/write-run.mjs'
import { repoRoot } from './docs/repo-root.mjs'

const CLI = join(repoRoot, 'packages/viewer/dist-cli/main.js')
const SHADCN = join(repoRoot, 'examples/shadcn')
const SHADCN_DATA = join(SHADCN, '.describe-me')
const SHADCN_CHANGED = join(SHADCN, 'node_modules/.describe-me-changed')
const MARKER = '<!-- describe-me:changes -->'
const COMMENT_LIMIT = 65_536
const NEW_CLASS = 'badge-spaced'

if (!existsSync(CLI)) {
  console.error('check-diff: packages/viewer/dist-cli/main.js is missing. Run pnpm build first.')
  process.exit(1)
}

if (!existsSync(join(SHADCN_DATA, 'manifest.json'))) {
  console.error(
    'check-diff: examples/shadcn/.describe-me/manifest.json is missing. Run pnpm build and pnpm --filter shadcn test first.',
  )

  process.exit(1)
}

const { changesMarkdown } = await import('../packages/viewer/dist-cli/changes-markdown.js')
const { parseArgs } = await import('../packages/viewer/dist-cli/parse-args.js')

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

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-diff-'))
  directories.push(dir)

  return dir
}

/** A data directory with these tests. */
function run(options) {
  const dir = tempDir()
  writeRun(dir, options)

  return dir
}

function test(module, name, snapshots, extra = {}) {
  const [suite, ...rest] = name.split(' > ')
  const path = rest.length === 0 ? [] : [suite, ...rest.slice(0, -1)]
  const own = rest.length === 0 ? suite : rest[rest.length - 1]

  return {
    module,
    path,
    name: own,
    frames: snapshots.map((value) => ({ snapshot: value })),
    ...extra,
  }
}

function cli(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })
}

/** `diff --out` into a fresh directory, with what it wrote. */
function diffOut(base, data) {
  const out = join(tempDir(), 'changes')
  const result = cli(['diff', '--base', base, '--data', data, '--out', out])
  const read = (file) =>
    existsSync(join(out, file)) ? readFileSync(join(out, file), 'utf8') : undefined

  const json = read('changes.json')

  return {
    result,
    report: json === undefined ? undefined : JSON.parse(json),
    markdown: read('changes.md') ?? '',
  }
}

function exitDetail(result) {
  return `exit ${result.status}, stderr ${JSON.stringify(result.stderr)}`
}

/** `change:kind:base index:head index` for each frame entry. */
function frameShapes(entry) {
  return entry.frames.map(
    (frame) =>
      `${frame.change}:${frame.kind ?? ''}:${frame.base?.index ?? '-'}:${frame.head?.index ?? '-'}`,
  )
}

function entryNamed(report, fullName) {
  return report.tests.find((entry) => entry.fullName === fullName)
}

/** The lines of a `###` section or the `<details>` block, without the heading. */
function sectionOf(markdown, heading) {
  const start = markdown.indexOf(heading)

  if (start < 0) {
    return undefined
  }

  const body = markdown.slice(start + heading.length)
  const end = body.search(/\n### |\n<details>/)

  return end < 0 ? body : body.slice(0, end)
}

// ---------- synthetic runs ----------

async function checkNothingChanged() {
  const tests = [
    test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })]),
    test('src/a.test.tsx', 'A > two', [snapshot({ text: 'two' }), snapshot({ text: 'two!' })]),
    test('src/b.test.tsx', 'B > three', []),
  ]

  const left = run({ tests })
  const right = run({ tests })

  for (const [label, base, data] of [
    ['identical directories', left, right],
    ['one directory as both sides', left, left],
  ]) {
    const { result, report, markdown } = diffOut(base, data)

    await check(`1. ${label}: exit 0 and no test entry`, () =>
      same(
        { status: result.status, tests: report?.tests, unchanged: report?.counts.tests.unchanged },
        { status: 0, tests: [], unchanged: 3 },
      ),
    )

    await check(`1. ${label}: changes.md is the marker and "Nothing changed"`, () =>
      same(markdown, `${MARKER}\n\nNothing changed against the base. 3 tests compared.\n`),
    )
  }

  const single = run({ tests: [tests[0]] })
  const { markdown } = diffOut(single, single)

  await check('1. one test: "1 test compared"', () =>
    same(markdown, `${MARKER}\n\nNothing changed against the base. 1 test compared.\n`),
  )
}

async function checkAddedStep() {
  const steps = (css, names) => names.map((text) => snapshot({ text, css }))
  const name = 'Form > submits'
  const base = run({ tests: [test('src/form.test.tsx', name, steps('a{}', ['a', 'b', 'c']))] })
  const head = run({
    tests: [test('src/form.test.tsx', name, steps('a{}', ['a', 'x', 'b', 'c']))],
  })

  const { report } = diffOut(base, head)

  await check('2. one added step: one added frame at head index 1, kind dom', () =>
    same(
      { kind: report.tests[0]?.kind, frames: frameShapes(report.tests[0]) },
      { kind: 'dom', frames: ['added::-:1'] },
    ),
  )

  await check('2. one added step: 3 unchanged frames', () =>
    same(report.counts.frames, { changed: 0, dom: 0, css: 0, added: 1, removed: 0, unchanged: 3 }),
  )

  const shorter = run({ tests: [test('src/form.test.tsx', name, steps('a{}', ['a', 'c']))] })
  const removedStep = diffOut(base, shorter).report

  await check('2. one removed step: one removed frame at base index 1, kind dom', () =>
    same(
      {
        kind: removedStep.tests[0]?.kind,
        frames: frameShapes(removedStep.tests[0]),
        counts: removedStep.counts.frames,
      },
      {
        kind: 'dom',
        frames: ['removed::1:-'],
        counts: { changed: 0, dom: 0, css: 0, added: 0, removed: 1, unchanged: 2 },
      },
    ),
  )

  const fewer = run({ tests: [test('src/form.test.tsx', name, steps('a{}', ['a', 'y']))] })
  const leftover = diffOut(base, fewer).report

  await check('2. two frames against one: a DOM change in order, then a removed frame', () =>
    same(
      { kind: leftover.tests[0]?.kind, frames: frameShapes(leftover.tests[0]) },
      { kind: 'dom', frames: ['changed:dom:1:1', 'removed::2:-'] },
    ),
  )

  const changedSheet = run({
    tests: [test('src/form.test.tsx', name, steps('b{}', ['a', 'x', 'b', 'c']))],
  })

  const global = diffOut(base, changedSheet).report

  await check('3. an added step and a changed global sheet: 3 css pairs and 1 added frame', () =>
    same(
      { kind: global.tests[0]?.kind, frames: frameShapes(global.tests[0]) },
      {
        kind: 'dom',
        frames: ['changed:css:0:0', 'added::-:1', 'changed:css:1:2', 'changed:css:2:3'],
      },
    ),
  )

  await check('3. an added step and a changed global sheet: frame counts', () =>
    same(global.counts.frames, { changed: 3, dom: 0, css: 3, added: 1, removed: 0, unchanged: 0 }),
  )
}

async function checkCssAndDom() {
  const cases = [
    ['Css > inline _cssText', { css: 'a { color: red }' }, { css: 'a { color: blue }' }],
    [
      'Css > describe-me-style reference',
      { css: 'a { color: red }', cssIn: 'reference' },
      { css: 'a { color: blue }', cssIn: 'reference' },
    ],
    [
      'Css > style text',
      { css: 'a { color: red }', cssIn: 'text' },
      { css: 'a { color: blue }', cssIn: 'text' },
    ],
    ['Dom > class attribute', { className: 'box' }, { className: 'box wide' }],
    ['Dom > states attribute', { states: 'hover' }, { states: 'hover focus' }],
    ['Dom > asset URL', { image: '3f2a9c1d0b7e4a55.svg' }, { image: '9c1d0b7e4a553f2a.svg' }],
  ]

  const base = run({
    tests: cases.map(([name, before]) => test('src/kinds.test.tsx', name, [snapshot(before)])),
  })

  const head = run({
    tests: cases.map(([name, , after]) => test('src/kinds.test.tsx', name, [snapshot(after)])),
  })

  const { report, markdown } = diffOut(base, head)
  const details = markdown.slice(markdown.indexOf('<details>'))

  for (const [name] of cases) {
    const kind = name.startsWith('Css') ? 'css' : 'dom'
    const number = kind === 'css' ? 4 : 5

    await check(`${number}. ${name}: kind ${kind}`, () =>
      same(
        { kind: entryNamed(report, name)?.kind, frames: frameShapes(entryNamed(report, name)) },
        { kind, frames: [`changed:${kind}:0:0`] },
      ),
    )
  }

  await check('4. CSS-only tests are inside <details> and not under ### Changed', () => {
    const changedSection = sectionOf(markdown, '### Changed') ?? ''
    const cssNames = cases.map(([name]) => name).filter((name) => name.startsWith('Css'))

    return {
      passed:
        markdown.includes('<details><summary>3 tests changed only in CSS</summary>\n\n') &&
        cssNames.every((name) => details.includes(`\`${name}\``)) &&
        cssNames.every((name) => !changedSection.includes(name)),
      detail: markdown,
    }
  })
}

async function checkNoChange() {
  const frames = [snapshot({ text: 'a' }), snapshot({ text: 'b' })]
  const base = run({
    tests: [
      {
        ...test('src/same.test.tsx', 'Same > test', []),
        duration: 10,
        frames: frames.map((value) => ({ snapshot: value, label: 'click', at: 0, meta: { n: 1 } })),
      },
    ],
  })

  const head = run({
    tests: [
      {
        ...test('src/same.test.tsx', 'Same > test', []),
        duration: 25,
        frames: frames.map((value) => ({ snapshot: value, label: 'tap', at: 7, meta: { n: 2 } })),
      },
    ],
  })

  const { report } = diffOut(base, head)

  await check('6. other labels, at, meta and duration with the same snapshots: unchanged', () =>
    same(
      { tests: report.tests, unchanged: report.counts.tests.unchanged },
      { tests: [], unchanged: 1 },
    ),
  )
}

async function checkStateChange() {
  const frames = [snapshot({ text: 'state' })]
  const base = run({ tests: [test('src/state.test.tsx', 'State > flips', frames)] })
  const head = run({
    tests: [test('src/state.test.tsx', 'State > flips', frames, { state: 'failed' })],
  })

  const { report, markdown } = diffOut(base, head)
  const entry = report.tests[0]

  await check('7. passed → failed: changed with state and no kind', () =>
    same(entry, {
      change: 'changed',
      id: entry?.id,
      module: 'src/state.test.tsx',
      fullName: 'State > flips',
      state: { base: 'passed', head: 'failed' },
      frames: [],
    }),
  )

  await check('7. passed → failed: under ### Changed', () => ({
    passed: (sectionOf(markdown, '### Changed') ?? '').includes(
      '- `State > flips`: state `passed` → `failed`',
    ),
    detail: markdown,
  }))
}

async function checkAddedRemovedMoved() {
  const keep = [snapshot({ text: 'keep' })]
  const base = run({
    tests: [
      test('src/a.test.tsx', 'A > keep', keep),
      test('src/a.test.tsx', 'A > old name', [snapshot({ text: 'renamed' })]),
      test('src/a.test.tsx', 'A > gone', [snapshot({ text: 'gone' })]),
      test('src/a.test.tsx', 'A > empty old', []),
      test('src/b.test.tsx', 'B > travels', [snapshot({ text: 'travels' })]),
    ],
  })

  const head = run({
    tests: [
      test('src/a.test.tsx', 'A > keep', keep),
      test('src/a.test.tsx', 'A > new name', [snapshot({ text: 'renamed' })]),
      test('src/a.test.tsx', 'A > fresh', [snapshot({ text: 'fresh' })]),
      test('src/a.test.tsx', 'A > empty new', []),
      test('src/c.test.tsx', 'B > travels', [snapshot({ text: 'travels' })]),
    ],
  })

  const { report, markdown } = diffOut(base, head)
  const shape = report.tests.map((entry) => ({
    change: entry.change,
    module: entry.module,
    fullName: entry.fullName,
    from: entry.from === undefined ? undefined : `${entry.from.module}::${entry.from.fullName}`,
    frames: entry.frames.length,
  }))

  await check('8. added, removed and moved tests: one entry each, from on the moved ones', () =>
    same(JSON.parse(JSON.stringify(shape)), [
      {
        change: 'moved',
        module: 'src/a.test.tsx',
        fullName: 'A > new name',
        from: 'src/a.test.tsx::A > old name',
        frames: 0,
      },
      { change: 'added', module: 'src/a.test.tsx', fullName: 'A > fresh', frames: 1 },
      { change: 'added', module: 'src/a.test.tsx', fullName: 'A > empty new', frames: 0 },
      {
        change: 'moved',
        module: 'src/c.test.tsx',
        fullName: 'B > travels',
        from: 'src/b.test.tsx::B > travels',
        frames: 0,
      },
      { change: 'removed', module: 'src/a.test.tsx', fullName: 'A > gone', frames: 1 },
      { change: 'removed', module: 'src/a.test.tsx', fullName: 'A > empty old', frames: 0 },
    ]),
  )

  await check('8. counts of added, removed and moved tests', () =>
    same(report.counts.tests, {
      changed: 0,
      dom: 0,
      css: 0,
      added: 2,
      removed: 2,
      moved: 2,
      unchanged: 1,
    }),
  )

  await check('8. changes.md lists them and where the moved tests were', () => ({
    passed:
      markdown.includes('0 of 5 tests changed, 2 added, 2 removed and 2 moved.') &&
      (sectionOf(markdown, '### Moved') ?? '').includes('- `A > new name`, was `A > old name`') &&
      (sectionOf(markdown, '### Moved') ?? '').includes(
        '- `B > travels`, was in `src/b.test.tsx`',
      ) &&
      (sectionOf(markdown, '### Added') ?? '').includes('- `A > empty new`') &&
      (sectionOf(markdown, '### Removed') ?? '').includes('- `A > empty old`'),
    detail: markdown,
  }))
}

function prop(name, type, extra = {}) {
  return { name, type, required: false, kind: 'other', ...extra }
}

async function checkProps() {
  const frames = [snapshot({ text: 'divider' })]
  const tests = [test('src/divider.test.tsx', 'Divider > renders', frames)]
  const base = run({
    tests,
    components: {
      Divider: {
        name: 'Divider',
        file: 'src/divider.tsx',
        props: [
          prop('orientation', "'horizontal' | 'vertical'", { defaultValue: "'horizontal'" }),
          prop('size', "'sm' | 'lg'", { description: 'How big.' }),
          prop('label', 'string'),
          prop('tone', "'plain' | 'strong'", { required: true }),
          prop('gap', 'number'),
          prop('muted', 'boolean', { defaultValue: 'false' }),
          prop('gone', 'boolean'),
        ],
      },
      OnlyInBase: { name: 'OnlyInBase', file: 'src/only.tsx', props: [prop('a', 'string')] },
    },
  })

  const head = run({
    tests,
    components: {
      Divider: {
        name: 'Divider',
        file: 'src/divider.tsx',
        props: [
          prop('orientation', "'horizontal' | 'vertical'", { defaultValue: "'vertical'" }),
          prop('size', "'sm' | 'md' | 'lg'", { description: 'How big it is.' }),
          prop('label', 'string', { required: true, kind: 'string' }),
          prop('tone', "'plain' | 'strong'"),
          prop('gap', 'number', { defaultValue: '4' }),
          prop('muted', 'boolean'),
          prop('inset', 'boolean'),
        ],
      },
      OnlyInHead: { name: 'OnlyInHead', file: 'src/only.tsx', props: [prop('b', 'string')] },
    },
  })

  const { report, markdown } = diffOut(base, head)

  await check('9. a changed default gives the exact line', () => ({
    passed: markdown
      .split('\n')
      .includes("- Divider: default of `orientation` changed from `'horizontal'` to `'vertical'`"),
    detail: markdown,
  }))

  await check('9. added, removed, new type, required, optional and default changes', () =>
    same(report.components, [
      {
        name: 'Divider',
        props: [
          {
            name: 'orientation',
            change: 'changed',
            base: {
              type: "'horizontal' | 'vertical'",
              required: false,
              defaultValue: "'horizontal'",
            },
            head: {
              type: "'horizontal' | 'vertical'",
              required: false,
              defaultValue: "'vertical'",
            },
          },
          {
            name: 'size',
            change: 'changed',
            base: { type: "'sm' | 'lg'", required: false },
            head: { type: "'sm' | 'md' | 'lg'", required: false },
          },
          {
            name: 'label',
            change: 'changed',
            base: { type: 'string', required: false },
            head: { type: 'string', required: true },
          },
          {
            name: 'tone',
            change: 'changed',
            base: { type: "'plain' | 'strong'", required: true },
            head: { type: "'plain' | 'strong'", required: false },
          },
          {
            name: 'gap',
            change: 'changed',
            base: { type: 'number', required: false },
            head: { type: 'number', required: false, defaultValue: '4' },
          },
          {
            name: 'muted',
            change: 'changed',
            base: { type: 'boolean', required: false, defaultValue: 'false' },
            head: { type: 'boolean', required: false },
          },
          { name: 'inset', change: 'added', head: { type: 'boolean', required: false } },
          { name: 'gone', change: 'removed', base: { type: 'boolean', required: false } },
        ],
      },
    ]),
  )

  await check('9. changes.md has a line for each prop change', () => {
    const lines = (sectionOf(markdown, '### Props') ?? '').split('\n')

    return {
      passed: [
        "- Divider: type of `size` changed from `'sm' | 'lg'` to `'sm' | 'md' | 'lg'`",
        '- Divider: `label` now required',
        '- Divider: `tone` now optional',
        '- Divider: `gap` got the default `4`',
        '- Divider: `muted` lost its default `false`',
        '- Divider: `inset` added, of type `boolean`',
        '- Divider: `gone` removed',
      ].every((line) => lines.includes(line)),
      detail: markdown,
    }
  })

  const withoutComponents = run({ tests, components: null })

  for (const [label, left, right] of [
    ['in the base', withoutComponents, head],
    ['in the head', base, withoutComponents],
  ]) {
    const missing = diffOut(left, right)

    await check(`9. a manifest without components ${label} counts as none`, () =>
      same(
        { status: missing.result.status, components: missing.report?.components },
        { status: 0, components: [] },
      ),
    )
  }
}

async function checkVersions() {
  const tests = [
    test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })]),
    test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one again' })]),
    test('src\\windows\\b.test.tsx', 'B > two', [snapshot({ text: 'two' })]),
  ]

  const legacy = run({ tests, generator: null, legacy: true })
  const current = run({ tests })
  const upgraded = diffOut(legacy, current)

  await check('10. a base before 0.5 against a current head: nothing added or removed', () =>
    same(
      {
        status: upgraded.result.status,
        tests: upgraded.report?.tests,
        unchanged: upgraded.report?.counts.tests.unchanged,
        versionsDiffer: upgraded.report?.versionsDiffer,
      },
      { status: 0, tests: [], unchanged: 3, versionsDiffer: true },
    ),
  )

  await check('10. a base before 0.5: the version note', () =>
    same(
      upgraded.markdown.split('\n')[4],
      [
        '> The base was recorded with a version before 0.5.1 and this run with',
        '`@describe-me/vitest` 0.12.1. Some changes may come from the update.',
      ].join(' '),
    ),
  )

  const older = run({ tests, generator: { ...CURRENT, version: '0.11.0' } })
  const updated = diffOut(older, current)

  await check('11. two versions: versionsDiffer and the note', () =>
    same(
      { versionsDiffer: updated.report?.versionsDiffer, note: updated.markdown.split('\n')[4] },
      {
        versionsDiffer: true,
        note: '> The base was recorded with `@describe-me/vitest` 0.11.0 and this run with 0.12.1. Some changes may come from the update.',
      },
    ),
  )

  const equal = diffOut(run({ tests }), current)

  await check('11. equal versions: no versionsDiffer and no note', () =>
    same(
      { versionsDiffer: equal.report?.versionsDiffer, note: equal.markdown.includes('\n> ') },
      { versionsDiffer: false, note: false },
    ),
  )
}

async function checkErrors() {
  const good = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })])] })
  const empty = tempDir()
  const invalid = tempDir()
  writeFileSync(join(invalid, 'manifest.json'), '{"version": 1, "modules": [ secret-piece')

  const foreign = tempDir()
  writeFileSync(join(foreign, 'manifest.json'), JSON.stringify({ version: 2, modules: [] }))

  const noModules = tempDir()
  writeFileSync(join(noModules, 'manifest.json'), JSON.stringify({ version: 1 }))

  const missingSnapshot = run({
    tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one changed' })])],
  })

  rmSync(join(missingSnapshot, 'snapshots'), { recursive: true })

  const notJsonSnapshot = run({
    tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one changed' })])],
  })

  for (const file of readdirSync(join(notJsonSnapshot, 'snapshots'))) {
    writeFileSync(join(notJsonSnapshot, 'snapshots', file), '{ not json')
  }

  const outside = run({
    tests: [
      { ...test('src/a.test.tsx', 'A > one', []), frames: [{ path: '../elsewhere/x.json' }] },
    ],
  })

  const cases = [
    ['no --base', ['diff', '--data', good], 'describe-me: diff needs --base <dir>'],
    [
      'no manifest in the base',
      ['diff', '--base', empty, '--data', good],
      `describe-me: no manifest at ${join(empty, 'manifest.json')}`,
    ],
    [
      'no manifest in the data directory',
      ['diff', '--base', good, '--data', empty],
      `describe-me: no manifest at ${join(empty, 'manifest.json')}`,
    ],
    [
      'invalid JSON',
      ['diff', '--base', invalid, '--data', good],
      `describe-me: cannot read ${join(invalid, 'manifest.json')}: not valid JSON\n`,
    ],
    [
      'a manifest of another version',
      ['diff', '--base', foreign, '--data', good],
      `describe-me: ${join(foreign, 'manifest.json')} is not a describe-me manifest`,
    ],
    [
      'a manifest without modules',
      ['diff', '--base', good, '--data', noModules],
      `describe-me: ${join(noModules, 'manifest.json')} is not a describe-me manifest`,
    ],
    [
      'a missing snapshot file',
      ['diff', '--base', good, '--data', missingSnapshot],
      `describe-me: cannot read ${join(missingSnapshot, 'snapshots')}`,
    ],
    [
      'a snapshot file that is not JSON',
      ['diff', '--base', good, '--data', notJsonSnapshot],
      `describe-me: cannot read ${join(notJsonSnapshot, 'snapshots')}`,
    ],
    [
      'a snapshot path outside the directory',
      ['diff', '--base', good, '--data', outside],
      `describe-me: ${join(outside, 'manifest.json')} names a snapshot outside ${outside}`,
    ],
  ]

  for (const [label, args, prefix] of cases) {
    const result = cli(args)

    await check(`12. ${label}: exit 1 and stderr starts with "${prefix.split(':')[0]}: "`, () => ({
      passed:
        result.status === 1 &&
        result.stderr.startsWith(prefix) &&
        !result.stderr.includes('secret-piece') &&
        result.stdout === '',
      detail: exitDetail(result),
    }))
  }
}

async function checkOut() {
  const base = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })])] })
  const head = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'two' })])] })
  const parent = tempDir()
  const out = join(parent, 'nested', 'changes')
  const result = cli(['diff', '--base', base, '--data', head, '--out', out])

  await check('13. --out creates a missing directory and writes both files', () => ({
    passed:
      result.status === 0 &&
      isDeepStrictEqual(readdirSync(out).sort(), ['changes.json', 'changes.md']) &&
      JSON.parse(readFileSync(join(out, 'changes.json'), 'utf8')).version === 1 &&
      readFileSync(join(out, 'changes.json'), 'utf8').endsWith('}\n') &&
      result.stdout === `1 of 1 test changed.\nWrote changes.json and changes.md to ${out}.\n`,
    detail: `${exitDetail(result)}, stdout ${JSON.stringify(result.stdout)}`,
  }))

  writeFileSync(join(out, 'shot.png'), 'kept')
  const again = cli(['diff', '--base', base, '--data', head, '--out', out])

  await check('13. --out keeps a file that was there', () => ({
    passed:
      again.status === 0 &&
      readFileSync(join(out, 'shot.png'), 'utf8') === 'kept' &&
      readdirSync(out).length === 3,
    detail: exitDetail(again),
  }))

  const cwd = tempDir()
  const before = [readdirSync(base).sort(), readdirSync(head).sort()]
  const printed = cli(['diff', '--base', base, '--data', head], cwd)

  await check('13. without --out: no file written and a summary on stdout', () =>
    same(
      {
        status: printed.status,
        cwd: readdirSync(cwd),
        dirs: [readdirSync(base).sort(), readdirSync(head).sort()],
        stdout: printed.stdout,
      },
      {
        status: 0,
        cwd: [],
        dirs: before,
        stdout: [
          '1 of 1 test changed.',
          '',
          'Changed',
          '  src/a.test.tsx',
          '    A > one: 1 frame changed',
          '',
        ].join('\n'),
      },
    ),
  )

  await checkFullSummary()
}

/** Every part of the summary: the version note, each section and the CSS-only count. */
async function checkFullSummary() {
  const box = (defaultValue) => ({
    Box: {
      name: 'Box',
      file: 'src/box.tsx',
      props: [prop('size', "'sm' | 'lg'", { defaultValue })],
    },
  })

  const css = (sheet) => [snapshot({ text: 'css', css: sheet })]
  const base = run({
    generator: { ...CURRENT, version: '0.11.0' },
    components: box("'sm'"),
    tests: [
      test('src/a.test.tsx', 'A > same', [snapshot({ text: 'same' })]),
      test('src/a.test.tsx', 'A > dom', [snapshot({ text: 'dom' })]),
      test('src/a.test.tsx', 'A > css', css('a{}')),
      test('src/a.test.tsx', 'A > gone', [snapshot({ text: 'gone' })]),
      test('src/a.test.tsx', 'B > moved', [snapshot({ text: 'moved' })]),
    ],
  })

  const head = run({
    components: box("'lg'"),
    tests: [
      test('src/a.test.tsx', 'A > same', [snapshot({ text: 'same' })]),
      test('src/a.test.tsx', 'A > dom', [snapshot({ text: 'dom!' })]),
      test('src/a.test.tsx', 'A > css', css('b{}')),
      test('src/a.test.tsx', 'A > fresh', [snapshot({ text: 'fresh' })]),
      test('src/b.test.tsx', 'B > moved', [snapshot({ text: 'moved' })]),
    ],
  })

  const printed = cli(['diff', '--base', base, '--data', head])

  await check('13. the summary has the note, every section and the CSS-only count', () =>
    same(
      { status: printed.status, stdout: printed.stdout },
      {
        status: 0,
        stdout: [
          '2 of 5 tests changed (1 only in CSS), 1 added, 1 removed and 1 moved. The props of 1 component changed.',
          'The base was recorded with @describe-me/vitest 0.11.0 and this run with 0.12.1. Some changes may come from the update.',
          '',
          'Changed',
          '  src/a.test.tsx',
          '    A > dom: 1 frame changed',
          '',
          'Props',
          "  Box: default of size changed from 'sm' to 'lg'",
          '',
          'Added',
          '  src/a.test.tsx',
          '    A > fresh',
          '',
          'Removed',
          '  src/a.test.tsx',
          '    A > gone',
          '',
          'Moved',
          '  src/b.test.tsx',
          '    B > moved, was in src/a.test.tsx',
          '',
          '1 test changed only in CSS.',
          '',
        ].join('\n'),
      },
    ),
  )
}

// ---------- the comment ----------

function frameChange(kind) {
  return {
    change: 'changed',
    kind,
    base: { index: 0, label: 'render', snapshot: 'snapshots/0000000000000000.json' },
    head: { index: 0, label: 'render', snapshot: 'snapshots/1111111111111111.json' },
  }
}

/** A report with thousands of tests in every list, long names and many prop changes. */
function largeReport() {
  const tests = []
  const long = 'a test with a rather long name that keeps going '.repeat(4)
  const module = (i) => `src/${'deeply/nested/'.repeat(8)}module-${i % 40}.test.tsx`

  for (let i = 0; i < 6000; i++) {
    const kind = i % 2 === 0 ? 'dom' : 'css'
    tests.push({
      change: 'changed',
      id: `c${i}`,
      module: module(i),
      fullName: `Suite ${i} > ${long}`,
      kind,
      frames: [frameChange(kind)],
    })
  }

  tests[0].fullName = 'x'.repeat(200_000)

  for (const change of ['added', 'removed', 'moved']) {
    for (let i = 0; i < 1500; i++) {
      tests.push({
        change,
        id: `${change}${i}`,
        module: module(i),
        fullName: `${change} ${i} > ${long}`,
        ...(change === 'moved'
          ? { from: { id: `f${i}`, module: module(i + 1), fullName: `was ${i}` } }
          : {}),
        frames: [],
      })
    }
  }

  const components = Array.from({ length: 400 }, (_, i) => ({
    name: `Component${i}`,
    props: Array.from({ length: 5 }, (__, j) => ({
      name: `prop${j}`,
      change: 'changed',
      base: { type: `'a' | 'b' | ${'"long" | '.repeat(20)}'c'`, required: false },
      head: { type: `'a' | 'b'`, required: true, defaultValue: "'a'" },
    })),
  }))

  return {
    version: 1,
    base: { generator: { ...CURRENT, version: '0.11.0' }, generatedAt: '' },
    head: { generator: CURRENT, generatedAt: '' },
    versionsDiffer: true,
    counts: {
      tests: {
        changed: 6000,
        dom: 3000,
        css: 3000,
        added: 1500,
        removed: 1500,
        moved: 1500,
        unchanged: 0,
      },
      frames: { changed: 6000, dom: 3000, css: 3000, added: 0, removed: 0, unchanged: 0 },
    },
    tests,
    components,
  }
}

async function checkLength() {
  const report = largeReport()

  for (const limit of [undefined, 10_000]) {
    const markdown = limit === undefined ? changesMarkdown(report) : changesMarkdown(report, limit)
    const lines = markdown.split('\n')
    const most = limit ?? COMMENT_LIMIT
    const label = `limit ${most}`

    await check(
      `14. a large report fits in ${label} with the marker and the sentence first`,
      () => ({
        passed:
          markdown.length <= most &&
          lines[0] === MARKER &&
          lines[2] ===
            '6000 of 9000 tests changed (3000 only in CSS), 1500 added, 1500 removed and 1500 moved. The props of 400 components changed.' &&
          lines[4].startsWith('> The base was recorded with'),
        detail: `${markdown.length} characters, starting ${JSON.stringify(lines.slice(0, 5))}`,
      }),
    )

    await check(`14. ${label}: every list ends with "- and N more"`, () => {
      const blocks = [
        '### Changed',
        '### Props',
        '### Added',
        '### Removed',
        '### Moved',
        '<details>',
      ]

      const endings = blocks.map((heading) => {
        const body = (sectionOf(markdown, heading) ?? '').replace('\n\n</details>', '').trimEnd()

        return body.split('\n').at(-1)
      })

      return {
        passed: endings.every((line) => /^- and \d+ more$/.test(line ?? '')),
        detail: JSON.stringify(endings),
      }
    })

    await check(`14. ${label}: one huge name is cut`, () => ({
      passed: Math.max(...lines.map((line) => line.length)) < 2000,
      detail: `${Math.max(...lines.map((line) => line.length))} characters in the longest line`,
    }))
  }
}

async function checkSafety() {
  const names = [
    'Mention > pings @someone',
    'Issue > fixes #12',
    'Html > renders <img src=x onerror=alert(1)>',
    '# heading',
    'Ticks > has a ` backtick',
    'Ticks > starts with ``` a fence',
    'Break > line\nbreak',
  ]

  const base = run({
    tests: names.map((name, i) =>
      test('src/@scope/#7.test.tsx', name, [snapshot({ text: `${i}` })]),
    ),
    components: {
      'Weird <b>@x</b>': { name: 'Weird', file: 'src/w.tsx', props: [prop('a', 'string')] },
    },
  })

  const head = run({
    tests: names.map((name, i) =>
      test('src/@scope/#7.test.tsx', name, [snapshot({ text: `${i}!` })]),
    ),
    components: {
      'Weird <b>@x</b>': { name: 'Weird', file: 'src/w.tsx', props: [prop('a', '<i>number</i>')] },
    },
  })

  const { markdown } = diffOut(base, head)
  const { spans, outside } = codeSpans(markdown)

  await check('15. names with @, #, <img>, # heading and backticks stay inside code spans', () => ({
    passed:
      ['@someone', '#12', '<img', 'heading', '<b>', '<i>', '@scope', '#7', 'break'].every(
        (text) => !outside.includes(text),
      ) && !markdown.split('\n').some((line) => line.startsWith('# ') || line.startsWith('break')),
    detail: outside,
  }))

  await check('15. each name is one whole code span', () => {
    const expected = [
      ...names.map((name) => name.replace('\n', ' ')),
      'src/@scope/#7.test.tsx',
      'Weird <b>@x</b>',
      '<i>number</i>',
    ]

    return {
      passed: expected.every((text) => spans.includes(text)),
      detail: JSON.stringify(expected.filter((text) => !spans.includes(text))),
    }
  })
}

async function checkParseArgs() {
  await check("16. parseArgs(['build']) keeps out describe-me-dist", () =>
    same(parseArgs(['build']).out, 'describe-me-dist'),
  )

  await check("16. parseArgs(['diff', '--base', 'x']): command diff, no out", () => {
    const options = parseArgs(['diff', '--base', 'x'])

    return same(
      { command: options.command, base: options.base, out: options.out },
      { command: 'diff', base: 'x', out: undefined },
    )
  })

  await check(
    "16. parseArgs(['diff', '--base', 'x', '--out', 'o']) and another word starts dev",
    () =>
      same(
        [parseArgs(['diff', '--base', 'x', '--out', 'o']).out, parseArgs(['other']).command],
        ['o', 'dev'],
      ),
  )

  const usage =
    '  describe-me diff  --base <dir> [--data .describe-me] [--out <dir>]   what changed against a base run'

  for (const [label, args] of [
    ['describe-me --help', ['--help']],
    ['describe-me without a command', []],
  ]) {
    const result = cli(args)

    await check(`16. ${label} prints the diff line of the usage`, () => ({
      passed: result.status === 0 && result.stdout.split('\n').includes(usage),
      detail: `${exitDetail(result)}, stdout ${JSON.stringify(result.stdout)}`,
    }))
  }
}

// ---------- examples/shadcn ----------

async function checkShadcnItself() {
  const { result, report, markdown } = diffOut(SHADCN_DATA, SHADCN_DATA)
  const count = report?.counts.tests.unchanged

  await check('17. examples/shadcn against itself: nothing changed', () =>
    same(
      { status: result.status, tests: report?.tests, markdown },
      {
        status: 0,
        tests: [],
        markdown: `${MARKER}\n\nNothing changed against the base. ${count} tests compared.\n`,
      },
    ),
  )
}

function generatedAt(dir) {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).generatedAt
}

function runShadcn(value) {
  return spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: SHADCN,
    env: { ...process.env, SHADCN_CHANGED: value },
    encoding: 'utf8',
  })
}

async function checkShadcnChanged() {
  const before = generatedAt(SHADCN_DATA)
  rmSync(SHADCN_CHANGED, { recursive: true, force: true })

  const result = runShadcn('1')

  await check('18. examples/shadcn with SHADCN_CHANGED=1 passes and writes its own output', () => ({
    passed:
      result.status === 0 &&
      existsSync(join(SHADCN_CHANGED, 'manifest.json')) &&
      generatedAt(SHADCN_DATA) === before,
    detail: `exit ${result.status}\n${result.stdout}\n${result.stderr}`,
  }))

  const unknown = runShadcn('yes')

  await check('18. another value of SHADCN_CHANGED fails', () => ({
    passed: unknown.status !== 0 && `${unknown.stdout}${unknown.stderr}`.includes('SHADCN_CHANGED'),
    detail: `exit ${unknown.status}`,
  }))

  if (!existsSync(join(SHADCN_CHANGED, 'manifest.json'))) {
    return
  }

  const { result: diff, report, markdown } = diffOut(SHADCN_DATA, SHADCN_CHANGED)
  const headFrames = JSON.parse(readFileSync(join(SHADCN_CHANGED, 'manifest.json'), 'utf8'))
    .modules.flatMap((mod) => mod.tests)
    .reduce((sum, entry) => sum + entry.frames.length, 0)

  await check('19. shadcn against SHADCN_CHANGED=1: 16 changed, 10 dom, 6 css', () =>
    same(
      { status: diff.status, tests: report?.counts.tests },
      {
        status: 0,
        tests: { changed: 16, dom: 10, css: 6, added: 0, removed: 0, moved: 0, unchanged: 0 },
      },
    ),
  )

  await check('19. shadcn against SHADCN_CHANGED=1: every frame changed', () =>
    same(report?.counts.frames.changed, headFrames),
  )

  const kinds = Object.fromEntries(report.tests.map((entry) => [entry.fullName, entry.kind]))

  await check('19. Card, both SignupCard tests and Badge changed their DOM', () =>
    same(
      [
        'Card > renders a header, content and footer',
        'SignupCard > submits the email',
        'SignupCard > rejects an empty email',
        'Badge > renders every variant',
      ].map((name) => kinds[name]),
      ['dom', 'dom', 'dom', 'dom'],
    ),
  )

  await check('19. every Input, Switch and Alert test changed only in CSS', () => {
    const names = Object.keys(kinds).filter((name) => /^(Input|Switch|Alert) > /.test(name))

    return {
      passed: names.length === 6 && names.every((name) => kinds[name] === 'css'),
      detail: JSON.stringify(kinds),
    }
  })

  await check('19. changes.md folds the CSS-only tests and fits the comment limit', () => ({
    passed:
      markdown.startsWith(`${MARKER}\n`) &&
      markdown.length <= COMMENT_LIMIT &&
      markdown.includes('<details><summary>6 tests changed only in CSS</summary>'),
    detail: markdown,
  }))

  await check(`19. the class ${NEW_CLASS} is only in the changed run`, () => ({
    passed: filesWith(SHADCN_CHANGED, NEW_CLASS) > 0 && filesWith(SHADCN_DATA, NEW_CLASS) === 0,
    detail: `${filesWith(SHADCN_CHANGED, NEW_CLASS)} files in the changed run, ${filesWith(SHADCN_DATA, NEW_CLASS)} in .describe-me`,
  }))
}

/** How many files under `dir` contain `text`. */
function filesWith(dir, text) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8').includes(text))
    .length
}

try {
  await checkNothingChanged()
  await checkAddedStep()
  await checkCssAndDom()
  await checkNoChange()
  await checkStateChange()
  await checkAddedRemovedMoved()
  await checkProps()
  await checkVersions()
  await checkErrors()
  await checkOut()
  await checkLength()
  await checkSafety()
  await checkParseArgs()
  await checkShadcnItself()
  await checkShadcnChanged()
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-diff: ${failures} of ${checks} checks failed`)
  process.exit(1)
}

console.log(`check-diff: all ${checks} checks passed`)
