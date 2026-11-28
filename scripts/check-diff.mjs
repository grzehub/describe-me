/**
 * Checks `describe-me diff` on the built CLI, by spawning
 * `packages/viewer/dist-cli/main.js diff` on data directories written to a
 * temp dir and importing its modules for unit cases:
 *
 *  1. identical directories, and one directory as both sides: no test entry,
 *     `changes.md` is the marker and `Nothing changed against the base. N tests
 *     compared.` (`1 test` for one), exit 0
 *  2. one step added in the middle (`a b c` → `a x b c`): one added frame at
 *     head index 1, 3 unchanged frames, kind `dom`, also with every snapshot
 *     file deleted, because frames with an unchanged name or in a one-sided
 *     gap are never read. One step removed (`a c`): one removed frame at base
 *     index 1. Two frames against one (`a y`): a `dom` change in order, then
 *     a removed frame, each side with its index, label and snapshot.
 *  3. the same while the global stylesheet changed in every frame: 3 `css`
 *     pairs and 1 added frame. Each case also checks its item in changes.md.
 *  4. a CSS-only change in an inline `_cssText`, in a `describe-me-style:`
 *     reference and in the text of a `<style>`: kind `css` each, listed inside
 *     `<details>` and not under `### Changed`
 *  5. a DOM change in a class attribute, in `data-describe-me-states` and in
 *     a `describe-me-asset:` URL: kind `dom` each
 *  6. other labels, `at`, `meta` and `duration` with the same snapshots:
 *     unchanged, also with every snapshot file deleted
 *  7. `passed` → `failed` with the same frames: `changed` with `state` and no
 *     `kind`, under `### Changed`. A test whose CSS and state both changed:
 *     kind `css` with its state, under `### Changed` and in the summary's
 *     Changed, never folded or counted as changed only in CSS
 *  8. a test added, one removed, one moved within its file, one moved to
 *     another file with a new state, one renamed into another file and two
 *     twins with the same snapshots: one entry each, `from` and `state` on
 *     the moved ones, twins paired in head order, every frame of the added
 *     and the removed test with its index, label and snapshot, the frames of
 *     moved tests counted as unchanged,
 *     and an added and a removed test without frames do not pair. Of two
 *     tests with one id, the first counts.
 *  9. props: the exact line for a changed default, and a `PropChange` and a
 *     line for a prop added (with its type, required and default), removed,
 *     with a new type, newly required, newly optional, with a default it did
 *     not have and without the one it had. Components by name, one without a
 *     `props` array loses them. A component on one side only and a change of
 *     description, kind or values do not count. Props alone make the
 *     sentence. A manifest without `components`, in the base or in the head,
 *     counts as none.
 * 10. a base written before 0.5 (no `generator`, Vitest's ids, no `vitestId`,
 *     a repeated name, a module id with `\`) against a current head with the
 *     same tests: nothing added or removed, `versionsDiffer` and the version note
 * 11. two generator versions: `versionsDiffer` and the note. Equal versions,
 *     and no generator on either side: neither. The note for a head without a
 *     generator, a generator without a
 *     version, another package and a version that is no plain word, and the
 *     generator and `generatedAt` of each run in the report.
 * 12. errors, each exit 1 with stderr starting `describe-me: `: no `--base`, no
 *     manifest in the base and in the data directory, invalid JSON (without a
 *     piece of the file), a manifest.json that cannot be read, a manifest that
 *     is not describe-me's, without modules or without any required field of a
 *     module, a test or a frame, a missing snapshot file or one that is not
 *     JSON, and a snapshot path outside the directory, absolute or the
 *     directory itself
 * 13. `--out` creates a missing directory, writes both files and keeps a file
 *     that was there. Without `--out`: no file written, a summary on stdout,
 *     which has the version note, the sections Changed, Props, Added, Removed
 *     and Moved, and the number of tests that changed only in CSS. The
 *     changes.md of the same pair, line by line.
 * 14. length: thousands of changed tests, long names and many prop changes
 *     give `changes.md` of at most 65,536 characters (or the given limit),
 *     marker and sentence first, every list ending with `- and N more`, where
 *     N counts the items it leaves out. A limit too small for any list keeps
 *     the marker and the sentence. A name is cut to 300 characters.
 * 15. Markdown safety: `@someone`, `#12`, `<img>`, `# heading`, backticks and a
 *     newline in a test name, and a component name that is no plain word,
 *     show only inside code spans. The summary keeps a name on one line.
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
 * 20. `--shots` flags, each exit 1 with stderr starting `describe-me: ` and
 *     nothing in `--out`: `--shots` without `--out`, `--width` abc, 0, 199,
 *     1921 and 1.5, and `--max-shots` -1 and x. The defaults of `parseArgs`:
 *     `shots` false, `width` 480 and max shots 20.
 * 21. Playwright missing, from a `--root` without it and from the synthetic
 *     root of the manifest: exit 1, the install commands and nothing written.
 *     Chromium missing, with PLAYWRIGHT_BROWSERS_PATH at an empty directory:
 *     exit 1 and `playwright install chromium`. With nothing to render, a
 *     removed test and a state change, or an added test under
 *     `--max-shots 0`, a `--root` without Playwright exits 0 and writes
 *     `shots` with no pair and no image.
 * 22. the three groups: a CSS change that paints the same is folded without
 *     an image, one that paints a background looks different with its image,
 *     a class that no rule targets stays under Changed as `looks the same`,
 *     a new text gets an image, an added test a PNG exactly 960 px wide, and
 *     a removed and a moved test none. `### Looks different` comes before
 *     `### Changed`, every image changes.md references exists as a PNG, every
 *     three-panel image is at least 2880 px wide, the `shot.file` values are
 *     the PNG files written, two tests with one pair count once, and a test
 *     with a pair that looks the same and an added frame has no look.
 * 23. `--max-shots 1` writes one PNG, for the first test that looks
 *     different, and lists the others without one. `--max-shots 0` compares
 *     and writes none. `--width 320` gives an added test a PNG 640 px wide.
 * 24. a head snapshot that holds `null`: exit 0, a warning, no look on its
 *     pair, `shots.failedPairs` 1 and the test under Changed. A font that
 *     fails to load on both sides: exit 0, a warning for each side that names
 *     the font, and the pair still compared.
 * 25. nothing left behind: no `packages/viewer/dist`, the same entries in
 *     `packages/viewer/node_modules` but an empty `.vite-temp`, the same
 *     `.vite`, an empty TMPDIR, the same files in both data directories, and
 *     a process that exits by itself. The test id `../evil](x)`, no safe file
 *     name, gets an image named after its SHA-1, inside `--out`, which
 *     changes.md shows.
 * 26. determinism: each example against a copy with every snapshot renamed.
 *     Every test with frames is `css`, no pair looks different or fails, no
 *     PNG is written and every test is folded. Prints the frames and the time.
 * 27. shadcn against its SHADCN_CHANGED=1 run with `--shots`: the 6 Button
 *     tests, Card, both SignupCard tests and Badge look different with one
 *     image each, 10 in all, and the 6 Input, Switch and Alert tests look
 *     the same, have no image and are folded. Prints the time.
 * 28. `pnpm changes-comment`, the comment of .github/workflows/changes.yml:
 *     a. scenario 27's output as shadcn and the other examples against
 *     themselves, with `--run-url`: exit 0, `changed=true`, the marker once
 *     on line 1, the four `## examples/<name>` headings in order, the run as
 *     a link, the other three sections without a change, 10 PNGs named
 *     `shadcn-<id>.png`, each referenced once and every reference with its
 *     file, and the body within 65,536 characters with 100 for each image.
 *     b. four reports without a change: the one sentence, no PNG,
 *     `changed=false`. c. four reports with thousands of changed tests and
 *     12 images each: within the limit, every heading and sentence kept, at
 *     least one image each, references and files matching both ways. A small
 *     report next to three such keeps its whole body. d. one image name in
 *     react-browser and react-jsdom gives two files. e. no mui/changes.json,
 *     a report that is not JSON or not version 1, an unsafe image name and a
 *     missing image: exit 1, stderr names the example, nothing written.
 *     f. 13 images in each example: exit 1, gh's limit of 50, nothing
 *     written. g. without GITHUB_OUTPUT and `--run-url`: exit 0, no link.
 *
 * Run after `pnpm build`, every example's tests and installing Chromium for
 * examples/react-browser. Scenarios 20 to 27 take Playwright from
 * examples/react-browser and from the shadcn example. Exits 1 on any
 * failure, when a call of the CLI or of `changes-comment` does not finish
 * within 30 s, and when a call with `--shots` does not finish within 300 s.
 *
 * Usage: `node scripts/check-diff.mjs`
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { codeSpans } from './check-diff/code-spans.mjs'
import { pngSize } from './check-diff/png-size.mjs'
import { renamedCopy } from './check-diff/renamed-copy.mjs'
import { shotsReport } from './check-diff/shots-report.mjs'
import { snapshot } from './check-diff/snapshot.mjs'
import { writeReport } from './check-diff/write-report.mjs'
import { CURRENT, writeRun } from './check-diff/write-run.mjs'
import { repoRoot } from './docs/repo-root.mjs'

const CLI = join(repoRoot, 'packages/viewer/dist-cli/main.js')
const SHADCN = join(repoRoot, 'examples/shadcn')
const SHADCN_DATA = join(SHADCN, '.describe-me')
const SHADCN_CHANGED = join(SHADCN, 'node_modules/.describe-me-changed')
const MARKER = '<!-- describe-me:changes -->'
const COMMENT_LIMIT = 65_536
const NEW_CLASS = 'badge-spaced'
const CLI_TIMEOUT = 30_000
const SHOTS_TIMEOUT = 300_000
const EXAMPLES = ['react-browser', 'react-jsdom', 'shadcn', 'mui']
// The synthetic runs name the root /project, and the jsdom examples install no Playwright.
const PLAYWRIGHT_ROOT = join(repoRoot, 'examples/react-browser')
const VIEWER = join(repoRoot, 'packages/viewer')
const COMMENT_SCRIPT = join(repoRoot, 'scripts/changes-comment.mjs')
const RUN_URL = 'https://github.com/owner/repo/actions/runs/1'
/** What `changes-comment` leaves for each image, whose path gh swaps for a longer URL. */
const IMAGE_ROOM = 100

if (!existsSync(CLI)) {
  console.error('check-diff: packages/viewer/dist-cli/main.js is missing. Run pnpm build first.')
  process.exit(1)
}

const missingData = EXAMPLES.filter(
  (name) => !existsSync(join(repoRoot, 'examples', name, '.describe-me', 'manifest.json')),
)

if (missingData.length > 0) {
  console.error(
    `check-diff: no .describe-me/manifest.json in ${missingData.map((name) => `examples/${name}`).join(', ')}. Run pnpm build, every example's tests and pnpm --filter react-browser exec playwright install chromium first.`,
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

/** Change a written manifest in place. */
function editManifest(dir, edit) {
  const file = join(dir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  edit(manifest)
  writeFileSync(file, JSON.stringify(manifest, null, 2))
}

/** The same directory without its snapshot files, so a diff that reads one fails. */
function withoutSnapshots(dir) {
  rmSync(join(dir, 'snapshots'), { recursive: true, force: true })

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

/** A command that does not exit, such as `diff` parsed as `dev`, ends the check instead of hanging it. */
function cli(args, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: CLI_TIMEOUT,
  })

  if (result.error !== undefined) {
    throw new Error(`describe-me ${args.join(' ')} did not finish: ${result.error.message}`)
  }

  return result
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

  const { report, markdown } = diffOut(base, head)

  await check('2. one added step: one added frame at head index 1, kind dom', () =>
    same(
      {
        kind: report.tests[0]?.kind,
        frames: frameShapes(report.tests[0]),
        item: markdown.split('\n').includes('- `Form > submits`: 1 frame added'),
      },
      { kind: 'dom', frames: ['added::-:1'], item: true },
    ),
  )

  const leanBase = withoutSnapshots(
    run({ tests: [test('src/form.test.tsx', name, steps('a{}', ['a', 'b', 'c']))] }),
  )

  const leanHead = withoutSnapshots(
    run({ tests: [test('src/form.test.tsx', name, steps('a{}', ['a', 'x', 'b', 'c']))] }),
  )

  const lean = diffOut(leanBase, leanHead)

  await check('2. frames with an unchanged name or in a one-sided gap are never read', () =>
    same(
      { status: lean.result.status, frames: frameShapes(lean.report?.tests[0] ?? { frames: [] }) },
      { status: 0, frames: ['added::-:1'] },
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

  const fewer = run({
    tests: [
      {
        ...test('src/form.test.tsx', name, []),
        frames: steps('a{}', ['a', 'y']).map((value, i) => ({
          snapshot: value,
          label: `step ${i}`,
        })),
      },
    ],
  })

  const leftover = diffOut(base, fewer)
  const [baseFrames, headFrames] = [base, fewer].map(
    (dir) =>
      JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).modules[0].tests[0].frames,
  )

  await check('2. a frame names its index, label and snapshot on each side', () =>
    same(leftover.report.tests[0]?.frames, [
      {
        change: 'changed',
        kind: 'dom',
        base: { index: 1, label: 'frame 1', snapshot: baseFrames[1].snapshot },
        head: { index: 1, label: 'step 1', snapshot: headFrames[1].snapshot },
      },
      { change: 'removed', base: { index: 2, label: 'frame 2', snapshot: baseFrames[2].snapshot } },
    ]),
  )

  await check('2. two frames against one: a DOM change in order, then a removed frame', () =>
    same(
      {
        kind: leftover.report.tests[0]?.kind,
        frames: frameShapes(leftover.report.tests[0]),
        item: leftover.markdown
          .split('\n')
          .includes('- `Form > submits`: 1 frame changed and 1 removed'),
      },
      { kind: 'dom', frames: ['changed:dom:1:1', 'removed::2:-'], item: true },
    ),
  )

  const changedSheet = run({
    tests: [test('src/form.test.tsx', name, steps('b{}', ['a', 'x', 'b', 'c']))],
  })

  const globalOut = diffOut(base, changedSheet)
  const global = globalOut.report

  await check('3. an added step and a changed global sheet: 3 css pairs and 1 added frame', () =>
    same(
      {
        kind: global.tests[0]?.kind,
        frames: frameShapes(global.tests[0]),
        item: globalOut.markdown
          .split('\n')
          .includes('- `Form > submits`: 3 frames changed and 1 added'),
      },
      {
        kind: 'dom',
        frames: ['changed:css:0:0', 'added::-:1', 'changed:css:1:2', 'changed:css:2:3'],
        item: true,
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

  const lean = diffOut(withoutSnapshots(base), withoutSnapshots(head))

  await check('6. an unchanged test is only counted, without reading its snapshot files', () =>
    same({ status: lean.result.status, tests: lean.report?.tests }, { status: 0, tests: [] }),
  )
}

async function checkStateChange() {
  const frames = [snapshot({ text: 'state' })]
  const sheet = (css) => [snapshot({ text: 'both', css })]
  const base = run({
    tests: [
      test('src/state.test.tsx', 'State > flips', frames),
      test('src/state.test.tsx', 'State > both', sheet('a{}')),
    ],
  })

  const head = run({
    tests: [
      test('src/state.test.tsx', 'State > flips', frames, { state: 'failed' }),
      test('src/state.test.tsx', 'State > both', sheet('b{}'), { state: 'failed' }),
    ],
  })

  const { report, markdown } = diffOut(base, head)
  const entry = report.tests[0]
  const both = entryNamed(report, 'State > both')

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

  await check('7. a CSS change with a state change: kind css and the state', () =>
    same(
      { kind: both?.kind, state: both?.state, frames: frameShapes(both ?? { frames: [] }) },
      { kind: 'css', state: { base: 'passed', head: 'failed' }, frames: ['changed:css:0:0'] },
    ),
  )

  await check('7. a CSS change with a state change shows under ### Changed, not folded', () => ({
    passed:
      (sectionOf(markdown, '### Changed') ?? '').includes(
        '- `State > both`: 1 frame changed, state `passed` → `failed`',
      ) &&
      !markdown.includes('<details>') &&
      markdown.split('\n')[2] === '2 of 2 tests changed.' &&
      report.counts.tests.css === 1,
    detail: markdown,
  }))

  const printed = cli(['diff', '--base', base, '--data', head])

  await check('7. the summary lists both under Changed and counts no CSS-only test', () =>
    same(
      printed.stdout,
      [
        '2 of 2 tests changed.',
        '',
        'Changed',
        '  src/state.test.tsx',
        '    State > flips: state passed → failed',
        '    State > both: 1 frame changed, state passed → failed',
        '',
      ].join('\n'),
    ),
  )
}

async function checkAddedRemovedMoved() {
  const keep = [snapshot({ text: 'keep' })]
  const twin = [snapshot({ text: 'twin' })]
  const base = run({
    tests: [
      test('src/a.test.tsx', 'A > keep', keep),
      test('src/a.test.tsx', 'A > old name', [snapshot({ text: 'renamed' })]),
      test('src/a.test.tsx', 'A > gone', [snapshot({ text: 'gone' }), snapshot({ text: 'gone!' })]),
      test('src/a.test.tsx', 'A > empty old', []),
      test('src/a.test.tsx', 'A > twin 1', twin),
      test('src/a.test.tsx', 'A > twin 2', twin),
      test('src/b.test.tsx', 'B > travels', [snapshot({ text: 'travels' })]),
      test('src/b.test.tsx', 'B > old place', [snapshot({ text: 'far' })]),
    ],
  })

  const head = run({
    tests: [
      test('src/a.test.tsx', 'A > keep', keep),
      test('src/a.test.tsx', 'A > new name', [snapshot({ text: 'renamed' })]),
      test('src/a.test.tsx', 'A > fresh', [
        snapshot({ text: 'fresh' }),
        snapshot({ text: 'fresh!' }),
      ]),
      test('src/a.test.tsx', 'A > empty new', []),
      test('src/a.test.tsx', 'A > twin x', twin),
      test('src/a.test.tsx', 'A > twin y', twin),
      test('src/c.test.tsx', 'B > travels', [snapshot({ text: 'travels' })], { state: 'failed' }),
      test('src/c.test.tsx', 'C > new place', [snapshot({ text: 'far' })]),
    ],
  })

  const { report, markdown } = diffOut(base, head)
  const shape = report.tests.map((entry) => ({
    change: entry.change,
    module: entry.module,
    fullName: entry.fullName,
    from: entry.from === undefined ? undefined : `${entry.from.module}::${entry.from.fullName}`,
    state: entry.state,
    frames: entry.frames.length,
  }))

  const moved = (module, fullName, from, extra = {}) => ({
    change: 'moved',
    module,
    fullName,
    from,
    ...extra,
    frames: 0,
  })

  await check('8. added, removed and moved tests: one entry each, from on the moved ones', () =>
    same(JSON.parse(JSON.stringify(shape)), [
      moved('src/a.test.tsx', 'A > new name', 'src/a.test.tsx::A > old name'),
      { change: 'added', module: 'src/a.test.tsx', fullName: 'A > fresh', frames: 2 },
      { change: 'added', module: 'src/a.test.tsx', fullName: 'A > empty new', frames: 0 },
      moved('src/a.test.tsx', 'A > twin x', 'src/a.test.tsx::A > twin 1'),
      moved('src/a.test.tsx', 'A > twin y', 'src/a.test.tsx::A > twin 2'),
      moved('src/c.test.tsx', 'B > travels', 'src/b.test.tsx::B > travels', {
        state: { base: 'passed', head: 'failed' },
      }),
      moved('src/c.test.tsx', 'C > new place', 'src/b.test.tsx::B > old place'),
      { change: 'removed', module: 'src/a.test.tsx', fullName: 'A > gone', frames: 2 },
      { change: 'removed', module: 'src/a.test.tsx', fullName: 'A > empty old', frames: 0 },
    ]),
  )

  await check('8. every frame of an added and a removed test, in order', () =>
    same(
      [
        frameShapes(entryNamed(report, 'A > fresh') ?? { frames: [] }),
        frameShapes(entryNamed(report, 'A > gone') ?? { frames: [] }),
      ],
      [
        ['added::-:0', 'added::-:1'],
        ['removed::0:-', 'removed::1:-'],
      ],
    ),
  )

  /** Every frame of a test in a written manifest, as the report names it on that side. */
  const sidesOf = (dir, fullName) =>
    JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
      .modules.flatMap((mod) => mod.tests)
      .find((entry) => entry.fullName === fullName)
      .frames.map((frame, index) => ({ index, label: frame.label, snapshot: frame.snapshot }))

  await check('8. every frame of an added and a removed test with its label and snapshot', () =>
    same(
      [entryNamed(report, 'A > fresh')?.frames, entryNamed(report, 'A > gone')?.frames],
      [
        sidesOf(head, 'A > fresh').map((side) => ({ change: 'added', head: side })),
        sidesOf(base, 'A > gone').map((side) => ({ change: 'removed', base: side })),
      ],
    ),
  )

  await check('8. counts of added, removed and moved tests and of their frames', () =>
    same(report.counts, {
      tests: { changed: 0, dom: 0, css: 0, added: 2, removed: 2, moved: 5, unchanged: 1 },
      frames: { changed: 0, dom: 0, css: 0, added: 2, removed: 2, unchanged: 6 },
    }),
  )

  await check('8. changes.md lists them, where the moved tests were and their state', () => {
    const movedLines = (sectionOf(markdown, '### Moved') ?? '').split('\n')

    return {
      passed:
        markdown.includes('0 of 8 tests changed, 2 added, 2 removed and 5 moved.') &&
        [
          '- `A > new name`, was `A > old name`',
          '- `A > twin x`, was `A > twin 1`',
          '- `A > twin y`, was `A > twin 2`',
          '- `B > travels`, was in `src/b.test.tsx`: state `passed` → `failed`',
          '- `C > new place`, was `B > old place` in `src/b.test.tsx`',
        ].every((line) => movedLines.includes(line)) &&
        (sectionOf(markdown, '### Added') ?? '').includes('- `A > empty new`') &&
        (sectionOf(markdown, '### Removed') ?? '').includes('- `A > empty old`'),
      detail: markdown,
    }
  })

  const one = [snapshot({ text: 'one' })]
  const single = run({ tests: [test('src/d.test.tsx', 'D > one', one)] })
  const duplicated = run({
    tests: [
      test('src/d.test.tsx', 'D > one', one),
      test('src/d.test.tsx', 'D > copy', [snapshot({ text: 'other' })]),
    ],
  })

  editManifest(duplicated, (manifest) => {
    const [first, second] = manifest.modules[0].tests
    second.id = first.id
  })

  const firstWins = diffOut(single, duplicated)

  await check('8. of two tests with one id, the first counts', () =>
    same(
      { tests: firstWins.report?.tests, unchanged: firstWins.report?.counts.tests.unchanged },
      { tests: [], unchanged: 1 },
    ),
  )
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
          prop('hint', 'string', { description: 'A hint.' }),
          prop('gone', 'boolean'),
        ],
      },
      Bare: { name: 'Bare', file: 'src/bare.tsx', props: [prop('a', 'string')] },
      Alpha: { name: 'Alpha', file: 'src/alpha.tsx', props: [prop('x', 'string')] },
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
          prop('hint', 'string', { description: 'Another hint.', kind: 'string', values: ['x'] }),
          prop('align', "'start' | 'end'", { required: true, defaultValue: "'start'" }),
          prop('inset', 'boolean'),
        ],
      },
      Bare: { name: 'Bare', file: 'src/bare.tsx' },
      Alpha: { name: 'Alpha', file: 'src/alpha.tsx', props: [prop('x', 'number')] },
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
        name: 'Alpha',
        props: [
          {
            name: 'x',
            change: 'changed',
            base: { type: 'string', required: false },
            head: { type: 'number', required: false },
          },
        ],
      },
      {
        name: 'Bare',
        props: [{ name: 'a', change: 'removed', base: { type: 'string', required: false } }],
      },
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
          {
            name: 'align',
            change: 'added',
            head: { type: "'start' | 'end'", required: true, defaultValue: "'start'" },
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
        "- Divider: `align` added, of type `'start' | 'end'`, required, default `'start'`",
        '- Divider: `inset` added, of type `boolean`',
        '- Divider: `gone` removed',
        '- Alpha: type of `x` changed from `string` to `number`',
        '- Bare: `a` removed',
      ].every((line) => lines.includes(line)),
      detail: markdown,
    }
  })

  await check('9. components by name, a description, kind and values do not count', () => {
    const lines = (sectionOf(markdown, '### Props') ?? '').split('\n')
    const alpha = lines.indexOf('- Alpha: type of `x` changed from `string` to `number`')
    const bare = lines.indexOf('- Bare: `a` removed')
    const divider = lines.findIndex((line) => line.startsWith('- Divider: '))

    return {
      passed: alpha >= 0 && alpha < bare && bare < divider && !markdown.includes('`hint`'),
      detail: markdown,
    }
  })

  await check('9. props alone make the sentence name them', () =>
    same(markdown.split('\n')[2], '0 of 1 test changed. The props of 3 components changed.'),
  )

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

  const neither = diffOut(run({ tests, generator: null }), run({ tests, generator: null }))

  await check('11. no generator on either side: no versionsDiffer and no note', () =>
    same(
      { versionsDiffer: neither.report?.versionsDiffer, markdown: neither.markdown },
      {
        versionsDiffer: false,
        markdown: `${MARKER}\n\nNothing changed against the base. 3 tests compared.\n`,
      },
    ),
  )

  const written = '2026-01-01T00:00:00.000Z'

  await check('10, 11. base and head name their generator and generatedAt', () =>
    same(
      [upgraded.report?.base, upgraded.report?.head, updated.report?.base],
      [
        { generatedAt: written },
        { generator: CURRENT, generatedAt: written },
        { generator: { ...CURRENT, version: '0.11.0' }, generatedAt: written },
      ],
    ),
  )

  const notes = [
    [
      'a head without a generator',
      current,
      run({ tests, generator: null }),
      '> The base was recorded with `@describe-me/vitest` 0.12.1 and this run with a version before 0.5.1.',
    ],
    [
      'a generator without a version, which counts as none',
      run({ tests, generator: { name: '@describe-me/vitest' } }),
      current,
      '> The base was recorded with a version before 0.5.1 and this run with `@describe-me/vitest` 0.12.1.',
    ],
    [
      'another package',
      run({ tests, generator: { name: '@acme/recorder', version: '2.0.0' } }),
      current,
      '> The base was recorded with `@acme/recorder` 2.0.0 and this run with `@describe-me/vitest` 0.12.1.',
    ],
    [
      'a version that is no plain word',
      run({ tests, generator: { ...CURRENT, version: '<b>1</b>' } }),
      current,
      '> The base was recorded with `@describe-me/vitest` `<b>1</b>` and this run with 0.12.1.',
    ],
  ]

  for (const [label, left, right, note] of notes) {
    const result = diffOut(left, right)

    await check(`11. ${label}: versionsDiffer and the note`, () =>
      same(
        { versionsDiffer: result.report?.versionsDiffer, note: result.markdown.split('\n')[4] },
        { versionsDiffer: true, note: `${note} Some changes may come from the update.` },
      ),
    )
  }
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

  const outsideAt = (path) =>
    run({ tests: [{ ...test('src/a.test.tsx', 'A > one', []), frames: [{ path }] }] })

  const outside = outsideAt('../elsewhere/x.json')
  const absolute = outsideAt('/elsewhere/x.json')
  const itself = outsideAt('.')
  const manifestDir = tempDir()
  mkdirSync(join(manifestDir, 'manifest.json'))

  const missingFields = [
    ['a module without an id', (mod) => delete mod.id],
    ['a module without tests', (mod) => delete mod.tests],
    ['a test without an id', (mod) => delete mod.tests[0].id],
    ['a test without a name', (mod) => delete mod.tests[0].name],
    ['a test without a path', (mod) => delete mod.tests[0].path],
    ['a test without a full name', (mod) => delete mod.tests[0].fullName],
    ['a test without frames', (mod) => delete mod.tests[0].frames],
    ['a frame without a snapshot', (mod) => delete mod.tests[0].frames[0].snapshot],
  ].map(([label, drop]) => {
    const dir = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })])] })

    editManifest(dir, (manifest) => {
      drop(manifest.modules[0])
    })

    return [
      label,
      ['diff', '--base', good, '--data', dir],
      `describe-me: ${join(dir, 'manifest.json')} is not a describe-me manifest`,
    ]
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
    [
      'an absolute snapshot path',
      ['diff', '--base', good, '--data', absolute],
      `describe-me: ${join(absolute, 'manifest.json')} names a snapshot outside ${absolute}`,
    ],
    [
      'a snapshot path that names the directory itself',
      ['diff', '--base', itself, '--data', good],
      `describe-me: ${join(itself, 'manifest.json')} names a snapshot outside ${itself}`,
    ],
    [
      'a manifest.json that cannot be read',
      ['diff', '--base', manifestDir, '--data', good],
      `describe-me: cannot read ${join(manifestDir, 'manifest.json')}\n`,
    ],
    ...missingFields,
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

  const { markdown } = diffOut(base, head)

  await check('13. changes.md of the same pair, every part in its place', () =>
    same(
      markdown,
      [
        MARKER,
        '',
        '2 of 5 tests changed (1 only in CSS), 1 added, 1 removed and 1 moved. The props of 1 component changed.',
        '',
        '> The base was recorded with `@describe-me/vitest` 0.11.0 and this run with 0.12.1. Some changes may come from the update.',
        '',
        '### Changed',
        '',
        '`src/a.test.tsx`',
        '',
        '- `A > dom`: 1 frame changed',
        '',
        '### Props',
        '',
        "- Box: default of `size` changed from `'sm'` to `'lg'`",
        '',
        '### Added',
        '',
        '`src/a.test.tsx`',
        '',
        '- `A > fresh`',
        '',
        '### Removed',
        '',
        '`src/a.test.tsx`',
        '',
        '- `A > gone`',
        '',
        '### Moved',
        '',
        '`src/b.test.tsx`',
        '',
        '- `B > moved`, was in `src/a.test.tsx`',
        '',
        '<details><summary>1 test changed only in CSS</summary>',
        '',
        '`src/a.test.tsx`',
        '',
        '- `A > css`: 1 frame changed',
        '',
        '</details>',
        '',
      ].join('\n'),
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

    await check(
      `14. ${label}: the N of "- and N more" counts the items each list leaves out`,
      () => {
        // Every prop of the report changes its type, whether it is required and its default.
        const totals = {
          '### Changed': 3000,
          '### Props': 6000,
          '### Added': 1500,
          '### Removed': 1500,
          '### Moved': 1500,
          '<details>': 3000,
        }

        const lists = Object.entries(totals).map(([heading, total]) => {
          const body = (sectionOf(markdown, heading) ?? '').replace('\n\n</details>', '').trimEnd()
          const lines = body.split('\n')
          const shown = lines.filter((line) => /^- (?!and \d+ more$)/.test(line)).length

          return { heading, last: lines.at(-1), expected: `- and ${total - shown} more` }
        })

        return {
          passed: lists.every((list) => list.last === list.expected),
          detail: JSON.stringify(lists),
        }
      },
    )

    await check(`14. ${label}: one huge name is cut`, () => ({
      passed: Math.max(...lines.map((line) => line.length)) < 2000,
      detail: `${Math.max(...lines.map((line) => line.length))} characters in the longest line`,
    }))
  }

  const sentence = changesMarkdown(report).split('\n')[2]

  await check('14. a limit too small for any list keeps the marker and the sentence', () =>
    same(changesMarkdown(report, 200), `${MARKER}\n\n${sentence}\n`),
  )

  const oneHugeName = {
    ...report,
    versionsDiffer: false,
    tests: [{ ...report.tests[1], fullName: `${'x'.repeat(10_000)}\n${'y'.repeat(10_000)}` }],
    components: [],
  }

  await check('14. a name is cut to 300 characters, the last one an ellipsis', () => ({
    passed: changesMarkdown(oneHugeName)
      .split('\n')
      .includes(`- \`${'x'.repeat(299)}…\`: 1 frame changed`),
    detail: changesMarkdown(oneHugeName).slice(0, 400),
  }))
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
    '`edge`',
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

  const printed = cli(['diff', '--base', base, '--data', head])
  const lines = printed.stdout.split('\n')

  await check('15. the summary keeps a name with a newline on one line', () => ({
    passed:
      lines.includes('    Break > line break: 1 frame changed') &&
      !lines.some((line) => line.startsWith('break')),
    detail: printed.stdout,
  }))
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
    '  describe-me diff  --base <dir> [--data .describe-me] [--out <dir> [--shots] [--width 480] [--max-shots 20] [--root <dir>]]   what changed against a base run'

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

// ---------- --shots ----------

/** Inline, so no style chunk has to load. The box makes a background change paint. */
const SHOT_CSS = 'body { margin: 0 } .box { padding: 8px; font: 16px sans-serif }'

function countText(count, noun) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

/** `diff` with `--shots` takes a timeout of its own, and says how long it took. */
function shotsCli(label, args, env = {}) {
  const started = Date.now()
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: SHOTS_TIMEOUT,
    env: { ...process.env, ...env },
  })

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`time  ${label}: ${seconds} s`)

  if (result.error !== undefined) {
    throw new Error(`describe-me ${args.join(' ')} did not finish: ${result.error.message}`)
  }

  return { result, seconds }
}

function pngsIn(dir) {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => file.endsWith('.png'))
        .sort()
    : []
}

/** `diff --out <fresh dir> --shots`, with what it wrote. */
function shotsOut(label, base, data, flags = [], env = {}) {
  const out = join(tempDir(), 'changes')
  const { result, seconds } = shotsCli(
    label,
    ['diff', '--base', base, '--data', data, '--out', out, '--shots', ...flags],
    env,
  )

  const read = (file) =>
    existsSync(join(out, file)) ? readFileSync(join(out, file), 'utf8') : undefined

  const json = read('changes.json')

  return {
    result,
    seconds,
    out,
    report: json === undefined ? undefined : JSON.parse(json),
    markdown: read('changes.md') ?? '',
    pngs: pngsIn(out),
  }
}

/** The file names of the `./<name>.png` images that changes.md shows, in order. */
function imageReferences(markdown) {
  return [...markdown.matchAll(/!\[[^\]]*\]\(\.\/([^)]+\.png)\)/g)].map((match) => match[1])
}

function shotFiles(report) {
  return (report?.tests ?? []).flatMap((entry) => (entry.shot ? [entry.shot.file] : [])).sort()
}

/** The folded block of changes.md, from `<details>` to `</details>`. */
function foldedOf(markdown) {
  const start = markdown.indexOf('<details>')

  return start < 0 ? '' : markdown.slice(start, markdown.indexOf('</details>', start))
}

async function checkShotFlags() {
  const base = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })])] })
  const head = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'two' })])] })
  const width = (value) =>
    `--width needs a whole number of CSS pixels from 200 to 1920, got "${value}"`

  const maxShots = (value) => `--max-shots needs a whole number from 0, got "${value}"`
  const cases = [
    ['--shots without --out', [], false, '--shots needs --out <dir>, where the images go'],
    ...['abc', '0', '199', '1921', '1.5'].map((value) => [
      `--width ${value}`,
      ['--width', value],
      true,
      width(value),
    ]),
    // parseArgs reads a value that starts with a dash as a missing one, and says so.
    ['--max-shots -1', ['--max-shots', '-1'], true, undefined],
    ['--max-shots=-1', ['--max-shots=-1'], true, maxShots('-1')],
    ['--max-shots x', ['--max-shots', 'x'], true, maxShots('x')],
  ]

  for (const [label, flags, withOut, message] of cases) {
    const out = join(tempDir(), 'changes')
    const result = cli([
      'diff',
      '--base',
      base,
      '--data',
      head,
      '--shots',
      ...(withOut ? ['--out', out] : []),
      ...flags,
    ])

    await check(
      `20. ${label}: exit 1, stderr starts with "describe-me: ", nothing in --out`,
      () => ({
        passed:
          result.status === 1 &&
          result.stderr.startsWith('describe-me: ') &&
          (message === undefined || result.stderr === `describe-me: ${message}\n`) &&
          result.stdout === '' &&
          !existsSync(out),
        detail: exitDetail(result),
      }),
    )
  }

  await check('20. parseArgs defaults: shots false, width 480, max shots 20', () => {
    const options = parseArgs(['diff', '--base', 'x'])

    return same(
      { shots: options.shots, width: options.width, maxShots: options.maxShots },
      { shots: false, width: '480', maxShots: '20' },
    )
  })
}

async function checkPlaywrightMissing() {
  const base = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'one' })])] })
  const head = run({ tests: [test('src/a.test.tsx', 'A > one', [snapshot({ text: 'two' })])] })
  const bare = tempDir()
  writeFileSync(join(bare, 'package.json'), '{ "name": "bare", "private": true }\n')

  for (const [label, flags, root] of [
    ['a --root without Playwright', ['--root', bare], bare],
    ['the manifest root /project', [], '/project'],
  ]) {
    const { result, out } = shotsOut(`21. ${label}`, base, head, flags)

    await check(`21. ${label}: exit 1, the install commands and nothing written`, () => ({
      passed:
        result.status === 1 &&
        result.stderr.startsWith(
          `describe-me: --shots needs Playwright, and cannot find it from ${root}. `,
        ) &&
        result.stderr.includes('npm install -D playwright') &&
        result.stderr.includes('npx playwright install chromium') &&
        result.stdout === '' &&
        !existsSync(out),
      detail: exitDetail(result),
    }))
  }

  const { result, out } = shotsOut(
    '21. Chromium missing',
    base,
    head,
    ['--root', PLAYWRIGHT_ROOT],
    { PLAYWRIGHT_BROWSERS_PATH: tempDir() },
  )

  await check(
    '21. Chromium missing: exit 1, "playwright install chromium", nothing written',
    () => ({
      passed:
        result.status === 1 &&
        result.stderr.startsWith('describe-me: cannot start Chromium for --shots (') &&
        result.stderr.includes('playwright install chromium') &&
        !existsSync(out),
      detail: exitDetail(result),
    }),
  )

  await checkNothingToRender(bare)
}

/** With nothing to render, `--shots` never loads Playwright, so a root without it still works. */
async function checkNothingToRender(bare) {
  const module = 'src/quiet.test.tsx'
  const kept = test(module, 'Quiet > kept', [snapshot({ text: 'kept' })])
  const flips = test(module, 'Quiet > flips', [snapshot({ text: 'flips' })])
  const gone = test(module, 'Quiet > gone', [snapshot({ text: 'gone' })])
  const base = run({ tests: [kept, flips, gone] })
  const flipped = run({ tests: [kept, { ...flips, state: 'failed' }] })
  const added = run({
    tests: [kept, flips, gone, test(module, 'Quiet > new', [snapshot({ text: 'new' })])],
  })

  for (const [label, head, flags, maxShots] of [
    ['a removed test and a state change', flipped, [], 20],
    ['an added test under --max-shots 0', added, ['--max-shots', '0'], 0],
  ]) {
    const { result, report, pngs, out } = shotsOut(`21. nothing to render: ${label}`, base, head, [
      '--root',
      bare,
      ...flags,
    ])

    await check(
      `21. nothing to render (${label}): exit 0 from a --root without Playwright, and shots`,
      () => ({
        passed:
          isDeepStrictEqual(
            { status: result.status, stderr: result.stderr, shots: report?.shots, pngs },
            {
              status: 0,
              stderr: '',
              shots: {
                width: 480,
                pixelRatio: 2,
                maxShots,
                pairs: 0,
                differentPairs: 0,
                failedPairs: 0,
                images: 0,
              },
              pngs: [],
            },
          ) && result.stdout.endsWith(`Wrote changes.json, changes.md and 0 images to ${out}.\n`),
        detail: `${exitDetail(result)}, stdout ${JSON.stringify(result.stdout)}, shots ${JSON.stringify(report?.shots)}`,
      }),
    )
  }
}

async function checkShotGroups() {
  const module = 'src/shots.test.tsx'
  const frame = (text, extra = {}) => snapshot({ text, css: SHOT_CSS, ...extra })
  const unused = { css: `${SHOT_CSS} .unused { color: red }` }
  const base = run({
    tests: [
      test(module, 'Css > paints the same', [frame('same')]),
      test(module, 'Css > paints a background', [frame('background')]),
      test(module, 'Dom > adds a class', [frame('class')]),
      test(module, 'Dom > changes the text', [frame('Hello')]),
      test(module, 'Twin > one', [frame('twin')]),
      test(module, 'Twin > two', [frame('twin')]),
      test(module, 'Step > adds a frame', [frame('step')]),
      test(module, 'Old > goes', [frame('old')]),
      test(module, 'Mover > before', [frame('mover')]),
    ],
  })

  const head = run({
    tests: [
      test(module, 'Css > paints the same', [frame('same', unused)]),
      test(module, 'Css > paints a background', [
        frame('background', { css: `${SHOT_CSS} .box { background: rgb(255, 0, 0) }` }),
      ]),
      test(module, 'Dom > adds a class', [frame('class', { className: 'box unstyled' })]),
      test(module, 'Dom > changes the text', [frame('Goodbye')]),
      test(module, 'Twin > one', [frame('twin!')]),
      test(module, 'Twin > two', [frame('twin!')]),
      test(module, 'Step > adds a frame', [frame('step', unused), frame('step 2')]),
      test(module, 'New > appears', [frame('new')]),
      test(module, 'Mover > after', [frame('mover')]),
    ],
  })

  const { result, report, markdown, pngs, out } = shotsOut('22. the three groups', base, head, [
    '--root',
    PLAYWRIGHT_ROOT,
  ])

  const entry = (name) => entryNamed(report ?? { tests: [] }, name)
  const different = sectionOf(markdown, '### Looks different') ?? ''
  const changed = sectionOf(markdown, '### Changed') ?? ''
  const folded = foldedOf(markdown)
  const shape = (name) => ({ kind: entry(name)?.kind, look: entry(name)?.look })

  await check('22. exit 0, how many tests look different, and how many images', () => ({
    passed:
      result.status === 0 &&
      result.stdout ===
        `7 of 9 tests changed (2 only in CSS), 1 added, 1 removed and 1 moved. 4 of the changed tests look different.\nWrote changes.json, changes.md and 5 images to ${out}.\n`,
    detail: `${exitDetail(result)}, stdout ${JSON.stringify(result.stdout)}`,
  }))

  await check('22. a CSS change that paints the same: look same, folded, no image', () =>
    same(
      {
        ...shape('Css > paints the same'),
        shot: entry('Css > paints the same')?.shot,
        folded: folded.includes(
          '<details><summary>1 test changed only in CSS and looks the same</summary>',
        ),
        inFold: folded.includes('`Css > paints the same`'),
      },
      { kind: 'css', look: 'same', shot: undefined, folded: true, inFold: true },
    ),
  )

  const background = entry('Css > paints a background')

  await check('22. a CSS change that paints a background: look different, with its image', () =>
    same(
      {
        ...shape('Css > paints a background'),
        listed: different.includes(
          `- \`Css > paints a background\`: 1 frame changed, 1 looks different\n\n  ![frame 1: before, after and the changed pixels](./${background?.shot?.file})`,
        ),
        written: pngs.includes(background?.shot?.file),
      },
      { kind: 'css', look: 'different', listed: true, written: true },
    ),
  )

  await check('22. a class that no rule targets: dom, look same, under Changed, no image', () =>
    same(
      {
        ...shape('Dom > adds a class'),
        shot: entry('Dom > adds a class')?.shot,
        listed: changed.includes('- `Dom > adds a class`: 1 frame changed, looks the same'),
      },
      { kind: 'dom', look: 'same', shot: undefined, listed: true },
    ),
  )

  const text = entry('Dom > changes the text')

  await check('22. a new text: dom, look different, with its image', () =>
    same(
      { ...shape('Dom > changes the text'), written: pngs.includes(text?.shot?.file) },
      { kind: 'dom', look: 'different', written: true },
    ),
  )

  const added = entry('New > appears')?.shot

  await check('22. an added test: one PNG exactly 960 px wide', () =>
    same(
      {
        file: added?.file,
        frame: added?.frame,
        width: added ? pngSize(join(out, added.file))?.width : undefined,
      },
      { file: `${entry('New > appears')?.id}.png`, frame: 0, width: 960 },
    ),
  )

  await check('22. a removed and a moved test: no image', () =>
    same(
      [entry('Old > goes')?.change, entry('Old > goes')?.shot, entry('Mover > after')?.shot],
      ['removed', undefined, undefined],
    ),
  )

  await check('22. ### Looks different comes before ### Changed', () => ({
    passed:
      markdown.includes('### Looks different') &&
      markdown.indexOf('### Looks different') < markdown.indexOf('### Changed'),
    detail: markdown,
  }))

  const references = imageReferences(markdown)

  await check('22. every image changes.md references exists and is a PNG', () => ({
    passed:
      references.length === 5 &&
      references.every((file) => existsSync(join(out, file)) && pngSize(join(out, file))),
    detail: JSON.stringify(references),
  }))

  await check('22. every three-panel image is at least 2880 px wide', () => {
    const widths = (report?.tests ?? [])
      .filter((entry) => entry.change === 'changed' && entry.shot)
      .map((entry) => pngSize(join(out, entry.shot.file))?.width)

    return {
      passed: widths.length === 4 && widths.every((value) => value >= 2880),
      detail: JSON.stringify(widths),
    }
  })

  await check('22. the shot.file values are exactly the PNG files written', () =>
    same(shotFiles(report), pngs),
  )

  await check('22. two tests with one pair count once, and the counts', () =>
    same(
      {
        shots: report?.shots,
        twins: [entry('Twin > one')?.look, entry('Twin > two')?.look],
        twinImages: [entry('Twin > one')?.shot?.file, entry('Twin > two')?.shot?.file].filter(
          (file) => pngs.includes(file),
        ).length,
      },
      {
        shots: {
          width: 480,
          pixelRatio: 2,
          maxShots: 20,
          pairs: 6,
          differentPairs: 3,
          failedPairs: 0,
          images: 5,
        },
        twins: ['different', 'different'],
        twinImages: 2,
      },
    ),
  )

  const step = entry('Step > adds a frame')

  await check('22. a pair that looks the same next to an added frame: no look on the test', () =>
    same(
      {
        kind: step?.kind,
        look: step?.look,
        frames: step?.frames.map((frame) => `${frame.change}:${frame.look ?? '-'}`),
        listed: changed.includes('- `Step > adds a frame`: 1 frame changed and 1 added\n'),
      },
      { kind: 'dom', look: undefined, frames: ['changed:same', 'added:-'], listed: true },
    ),
  )
}

async function checkShotBudget() {
  const module = 'src/budget.test.tsx'
  const frame = (text) => snapshot({ text, css: SHOT_CSS })
  const base = run({
    tests: [
      test(module, 'Budget > first', [frame('first')]),
      test(module, 'Budget > second', [frame('second')]),
    ],
  })

  const head = run({
    tests: [
      test(module, 'Budget > first', [frame('first!')]),
      test(module, 'Budget > second', [frame('second!')]),
      test(module, 'Budget > added', [frame('added')]),
    ],
  })

  const flags = (...more) => ['--root', PLAYWRIGHT_ROOT, ...more]
  const one = shotsOut('23. --max-shots 1', base, head, flags('--max-shots', '1'))
  const named = (report, name) => entryNamed(report ?? { tests: [] }, name)
  const first = named(one.report, 'Budget > first')
  const note = '1 test has no image, because `--max-shots` is 1.'

  await check('23. --max-shots 1: one PNG, for the first test that looks different', () =>
    same(
      {
        status: one.result.status,
        pngs: one.pngs,
        looks: ['first', 'second'].map((name) => named(one.report, `Budget > ${name}`)?.look),
        shots: ['first', 'second', 'added'].map(
          (name) => named(one.report, `Budget > ${name}`)?.shot?.file,
        ),
      },
      {
        status: 0,
        pngs: [`${first?.id}.png`],
        looks: ['different', 'different'],
        shots: [`${first?.id}.png`, undefined, undefined],
      },
    ),
  )

  await check('23. --max-shots 1: the others stay listed without an image', () => {
    const different = sectionOf(one.markdown, '### Looks different') ?? ''
    const added = sectionOf(one.markdown, '### Added') ?? ''

    return {
      passed:
        different.includes('- `Budget > second`: 1 frame changed, 1 looks different\n') &&
        different.includes(note) &&
        added.includes('- `Budget > added`\n') &&
        added.includes(note) &&
        isDeepStrictEqual(imageReferences(one.markdown), [`${first?.id}.png`]),
      detail: one.markdown,
    }
  })

  const none = shotsOut('23. --max-shots 0', base, head, flags('--max-shots', '0'))

  await check('23. --max-shots 0: compares the looks and writes no PNG', () =>
    same(
      {
        status: none.result.status,
        pngs: none.pngs,
        looks: ['first', 'second'].map((name) => named(none.report, `Budget > ${name}`)?.look),
        images: none.report?.shots.images,
        differentPairs: none.report?.shots.differentPairs,
      },
      { status: 0, pngs: [], looks: ['different', 'different'], images: 0, differentPairs: 2 },
    ),
  )

  const narrow = shotsOut('23. --width 320', base, head, flags('--width', '320'))
  const added = named(narrow.report, 'Budget > added')?.shot

  await check("23. --width 320: the added test's PNG is 640 px wide", () =>
    same(
      {
        status: narrow.result.status,
        width: added ? pngSize(join(narrow.out, added.file))?.width : undefined,
        summary: narrow.report?.shots.width,
      },
      { status: 0, width: 640, summary: 320 },
    ),
  )
}

async function checkShotFailure() {
  const name = 'Broken > renders'
  const base = run({
    tests: [test('src/broken.test.tsx', name, [snapshot({ text: 'fine', css: SHOT_CSS })])],
  })

  const head = run({
    tests: [test('src/broken.test.tsx', name, [snapshot({ text: 'broken', css: SHOT_CSS })])],
  })

  for (const file of readdirSync(join(head, 'snapshots'))) {
    writeFileSync(join(head, 'snapshots', file), 'null')
  }

  const { result, report, markdown, pngs } = shotsOut(
    '24. a frame that does not render',
    base,
    head,
    ['--root', PLAYWRIGHT_ROOT],
  )

  const entry = entryNamed(report ?? { tests: [] }, name)

  await check('24. a head snapshot that holds null: exit 0 and a warning', () => ({
    passed:
      result.status === 0 &&
      /^describe-me: frame head snapshots\/[0-9a-f]+\.json did not render \(.+\)$/m.test(
        result.stderr,
      ),
    detail: exitDetail(result),
  }))

  await check('24. no look on the pair, shots.failedPairs 1 and the test under Changed', () =>
    same(
      {
        frame: entry?.frames.map((frame) => frame.look ?? '-'),
        look: entry?.look,
        failedPairs: report?.shots.failedPairs,
        pngs,
        listed: (sectionOf(markdown, '### Changed') ?? '').includes(
          `- \`${name}\`: 1 frame changed, 1 did not render`,
        ),
      },
      { frame: ['-'], look: undefined, failedPairs: 1, pngs: [], listed: true },
    ),
  )

  await checkMissingFont()
}

/** A font that fails to load does not stop its frame, but each side that misses it warns. */
async function checkMissingFont() {
  const name = 'Font > is missing'
  // The asset is in neither data directory, so the face fails on both sides.
  const css = `${SHOT_CSS} @font-face { font-family: Missing; src: url("describe-me-asset:0000000000000000.woff2") } .box { font-family: Missing, sans-serif }`
  const frame = (text) => [snapshot({ text, css })]
  const base = run({ tests: [test('src/font.test.tsx', name, frame('font'))] })
  const head = run({ tests: [test('src/font.test.tsx', name, frame('font!'))] })
  const { result, report } = shotsOut('24. a frame without its font', base, head, [
    '--root',
    PLAYWRIGHT_ROOT,
  ])

  const pair = entryNamed(report ?? { tests: [] }, name)?.frames[0]
  const lines = result.stderr.split('\n')
  const warning = (side) =>
    `describe-me: frame ${side} ${pair?.[side]?.snapshot} rendered without font Missing, so its pair may differ for that alone`

  await check(
    '24. a font that fails to load: exit 0, a warning per side, the pair compared',
    () => ({
      passed:
        result.status === 0 &&
        lines.includes(warning('base')) &&
        lines.includes(warning('head')) &&
        pair?.look === 'different' &&
        report?.shots.failedPairs === 0,
      detail: `${exitDetail(result)}, look ${pair?.look}`,
    }),
  )
}

/** Every file and directory under `dir`, or `undefined` when it does not exist. */
function listing(dir) {
  return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).sort() : undefined
}

async function checkNothingLeft() {
  const module = 'src/left.test.tsx'
  const base = run({
    tests: [test(module, 'Left > renders', [snapshot({ text: 'before', css: SHOT_CSS })])],
  })

  const head = run({
    tests: [
      test(module, 'Left > renders', [snapshot({ text: 'after', css: SHOT_CSS })]),
      test(module, 'Left > appears', [snapshot({ text: 'new', css: SHOT_CSS })]),
    ],
  })

  // As a file name, this id would leave --out and end the Markdown link early.
  const unsafe = '../evil](x)'

  for (const dir of [base, head]) {
    editManifest(dir, (manifest) => {
      manifest.modules[0].tests[0].id = unsafe
    })
  }

  const modules = join(VIEWER, 'node_modules')
  const viteTemp = join(modules, '.vite-temp')
  const entries = () =>
    readdirSync(modules)
      .filter((entry) => entry !== '.vite-temp')
      .sort()

  const before = {
    modules: entries(),
    vite: listing(join(modules, '.vite')),
    base: listing(base),
    head: listing(head),
  }

  const temp = tempDir()
  const { result, report, markdown, pngs, out } = shotsOut(
    '25. nothing left behind',
    base,
    head,
    ['--root', PLAYWRIGHT_ROOT],
    {
      TMPDIR: temp,
    },
  )

  await check('25. exit 0 and two images, from a process that exits by itself', () => ({
    passed: result.status === 0 && result.signal === null && pngs.length === 2,
    detail: `${exitDetail(result)}, ${JSON.stringify(pngs)}`,
  }))

  const hashed = `${createHash('sha1').update(unsafe).digest('hex').slice(0, 12)}.png`
  const appears = entryNamed(report ?? { tests: [] }, 'Left > appears')

  await check(
    '25. an id that is no safe file name: an image named after its SHA-1 inside --out, shown by changes.md',
    () =>
      same(
        {
          id: entryNamed(report ?? { tests: [] }, 'Left > renders')?.id,
          shot: entryNamed(report ?? { tests: [] }, 'Left > renders')?.shot?.file,
          pngs,
          beside: readdirSync(join(out, '..')),
          shown: markdown.includes(`](./${hashed})`),
        },
        {
          id: unsafe,
          shot: hashed,
          pngs: [hashed, `${appears?.id}.png`].sort(),
          beside: ['changes'],
          shown: true,
        },
      ),
  )

  await check(
    '25. no dist, no file in node_modules but an empty .vite-temp, the same .vite, an empty TMPDIR, the same data',
    () =>
      same(
        {
          dist: existsSync(join(VIEWER, 'dist')),
          modules: entries(),
          viteTemp: listing(viteTemp) ?? [],
          vite: listing(join(modules, '.vite')),
          temp: readdirSync(temp),
          base: listing(base),
          head: listing(head),
        },
        { ...before, dist: false, viteTemp: [], temp: [] },
      ),
  )
}

async function checkDeterminism() {
  for (const name of EXAMPLES) {
    const data = join(repoRoot, 'examples', name, '.describe-me')
    const copy = renamedCopy(data, join(tempDir(), 'base'))
    const tests = JSON.parse(readFileSync(join(data, 'manifest.json'), 'utf8')).modules.flatMap(
      (mod) => mod.tests,
    )

    const withFrames = tests.filter((entry) => entry.frames.length > 0)
    const frames = withFrames.reduce((sum, entry) => sum + entry.frames.length, 0)
    // The jsdom examples install no Playwright.
    const flags = name === 'react-jsdom' || name === 'mui' ? ['--root', PLAYWRIGHT_ROOT] : []
    const { result, report, markdown, pngs, seconds } = shotsOut(`26. ${name}`, copy, data, flags)
    const notSame = (report?.tests ?? [])
      .filter((entry) => entry.look !== 'same')
      .map((entry) => entry.fullName)

    console.log(
      `      ${name}: ${frames} frames, ${report?.shots?.pairs} pairs rendered twice, ${seconds} s`,
    )

    await check(
      `26. ${name}: every test with frames is css, no pair differs or fails, no PNG`,
      () =>
        same(
          {
            status: result.status,
            kinds: [...new Set((report?.tests ?? []).map((entry) => entry.kind))],
            changed: report?.counts.tests.changed,
            differentPairs: report?.shots?.differentPairs,
            failedPairs: report?.shots?.failedPairs,
            notSame,
            pngs,
          },
          {
            status: 0,
            kinds: ['css'],
            changed: withFrames.length,
            differentPairs: 0,
            failedPairs: 0,
            notSame: [],
            pngs: [],
          },
        ),
    )

    await check(`26. ${name}: every test is folded`, () => ({
      passed:
        markdown.includes(
          `<details><summary>${countText(withFrames.length, 'test')} changed only in CSS and look the same</summary>`,
        ) &&
        !markdown.includes('### Looks different') &&
        !markdown.includes('### Changed'),
      detail: `${exitDetail(result)}\n${markdown.slice(0, 600)}`,
    }))
  }
}

async function checkShadcnShots() {
  if (!existsSync(join(SHADCN_CHANGED, 'manifest.json'))) {
    await check('27. shadcn against SHADCN_CHANGED=1 with --shots', () => ({
      passed: false,
      detail: 'scenario 18 wrote no SHADCN_CHANGED run',
    }))

    return
  }

  const { result, report, markdown, pngs, seconds, out } = shotsOut(
    '27. shadcn against SHADCN_CHANGED=1',
    SHADCN_DATA,
    SHADCN_CHANGED,
  )

  console.log(`      shadcn: ${report?.shots?.pairs} pairs, ${pngs.length} images, ${seconds} s`)

  const tests = report?.tests ?? []
  const lookOf = (pattern) =>
    tests.filter((entry) => pattern.test(entry.fullName)).map((entry) => entry.look)

  const different = tests.filter((entry) => entry.look === 'different')
  const expected =
    /^(Button > |Card > renders a header, content and footer$|SignupCard > |Badge > renders every variant$)/

  await check('27. shadcn with --shots: exit 0 and 10 images', () => ({
    passed:
      result.status === 0 &&
      pngs.length === 10 &&
      report?.shots.images === 10 &&
      report?.shots.failedPairs === 0 &&
      report?.shots.differentPairs >= 10 &&
      result.stdout.includes(' and 10 images to '),
    detail: `${exitDetail(result)}, shots ${JSON.stringify(report?.shots)}`,
  }))

  await check('27. the 6 Button tests, Card, both SignupCard tests and Badge look different', () =>
    same(
      {
        names: different.filter((entry) => expected.test(entry.fullName)).length,
        others: different
          .filter((entry) => !expected.test(entry.fullName))
          .map((entry) => entry.fullName),
        buttons: lookOf(/^Button > /).length,
        images: different.filter((entry) => pngs.includes(entry.shot?.file)).length,
      },
      { names: 10, others: [], buttons: 6, images: 10 },
    ),
  )

  const folded = foldedOf(markdown)
  const quiet = tests.filter((entry) => /^(Input|Switch|Alert) > /.test(entry.fullName))

  await check(
    '27. the 6 Input, Switch and Alert tests look the same, have no image, are folded',
    () =>
      same(
        {
          count: quiet.length,
          looks: [...new Set(quiet.map((entry) => entry.look))],
          shots: quiet.filter((entry) => entry.shot !== undefined).length,
          folded: quiet.every((entry) => folded.includes(`\`${entry.fullName}\``)),
          summary: folded.startsWith(
            '<details><summary>6 tests changed only in CSS and look the same</summary>',
          ),
        },
        { count: 6, looks: ['same'], shots: 0, folded: true, summary: true },
      ),
  )

  await check(
    '27. changes.md lists the 10 images under ### Looks different and fits the limit',
    () => {
      const section = sectionOf(markdown, '### Looks different') ?? ''
      const images = [...section.matchAll(/\]\(\.\/[0-9a-f]{12}\.png\)/g)].length

      return {
        passed: images === 10 && markdown.length <= COMMENT_LIMIT,
        detail: `${images} images, ${markdown.length} characters`,
      }
    },
  )

  return out
}

// ---------- the pull request comment ----------

/** `changes-comment <dir>`, with what it wrote into `<dir>/comment/` and into GITHUB_OUTPUT. */
function changesComment(dir, args = [], { githubOutput = true } = {}) {
  const outputFile = join(tempDir(), 'github-output')
  const env = { ...process.env, GITHUB_OUTPUT: outputFile }

  // A CI run of check-diff has GITHUB_OUTPUT set for its own step.
  if (!githubOutput) {
    delete env.GITHUB_OUTPUT
  }

  const result = spawnSync(process.execPath, [COMMENT_SCRIPT, dir, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: CLI_TIMEOUT,
    env,
  })

  if (result.error !== undefined) {
    throw new Error(`changes-comment ${dir} did not finish: ${result.error.message}`)
  }

  const comment = join(dir, 'comment')
  const bodyFile = join(comment, 'changes.md')

  return {
    result,
    body: existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : undefined,
    written: existsSync(comment),
    pngs: pngsIn(comment),
    output: existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : undefined,
  }
}

/** A directory with a `diff --out` directory per example: a report to write, or a data directory to diff against itself. */
function commentInput(examples) {
  const dir = tempDir()

  for (const [name, source] of Object.entries(examples)) {
    if (typeof source !== 'string') {
      writeReport(join(dir, name), source)
      continue
    }

    const result = cli(['diff', '--base', source, '--data', source, '--out', join(dir, name)])

    if (result.status !== 0) {
      throw new Error(`diff of ${name} against itself: ${exitDetail(result)}`)
    }
  }

  return dir
}

function exampleData(name) {
  return join(repoRoot, 'examples', name, '.describe-me')
}

/** The length GitHub counts once gh swapped each image path for an attachment URL, with room to spare. */
function commentCost(body) {
  return body.length + IMAGE_ROOM * imageReferences(body).length
}

/**
 * The body of `## examples/<name>`, up to the blank line before the next
 * heading of that level, so it ends with one newline as `changes.md` does.
 */
function exampleSection(body, name) {
  const heading = `## examples/${name}\n\n`
  const start = body.indexOf(heading)

  if (start < 0) {
    return undefined
  }

  const rest = body.slice(start + heading.length)
  const end = rest.indexOf('\n## ')

  return end < 0 ? rest : rest.slice(0, end)
}

function introOf(body) {
  return body.split('\n')[2]
}

const INTRO = '`describe-me diff --shots` against the base of this pull request:'

async function checkCommentExamples(shadcnShots) {
  if (shadcnShots === undefined) {
    await check('28. a: the four examples with shadcn --shots', () => ({
      passed: false,
      detail: 'scenario 27 wrote no --shots output',
    }))

    return
  }

  const dir = commentInput({
    'react-browser': exampleData('react-browser'),
    'react-jsdom': exampleData('react-jsdom'),
    mui: exampleData('mui'),
  })

  cpSync(shadcnShots, join(dir, 'shadcn'), { recursive: true })

  const { result, body = '', pngs, output } = changesComment(dir, ['--run-url', RUN_URL])
  const references = imageReferences(body)

  await check('28. a: the four examples with shadcn --shots: exit 0, changed=true', () => ({
    passed:
      result.status === 0 &&
      output === 'changed=true\n' &&
      result.stdout === '1 of 4 examples changed. Wrote comment/changes.md and 10 images.\n',
    detail: `${exitDetail(result)}, stdout ${JSON.stringify(result.stdout)}, GITHUB_OUTPUT ${JSON.stringify(output)}`,
  }))

  await check('28. a: the marker once on line 1, the headings in order, the run as a link', () =>
    same(
      {
        first: body.split('\n')[0],
        markers: body.split(MARKER).length - 1,
        headings: [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
        intro: introOf(body),
      },
      {
        first: MARKER,
        markers: 1,
        headings: EXAMPLES.map((name) => `examples/${name}`),
        intro: `${INTRO} 1 of 4 examples changed. [The run](${RUN_URL}) has the whole report as an artifact.`,
      },
    ),
  )

  await check('28. a: react-browser, react-jsdom and mui say that nothing changed', () =>
    same(
      ['react-browser', 'react-jsdom', 'mui'].map((name) =>
        /^Nothing changed against the base\. \d+ tests compared\.\n$/.test(
          exampleSection(body, name) ?? '',
        ),
      ),
      [true, true, true],
    ),
  )

  await check(
    '28. a: 10 PNGs named shadcn-<id>.png, each referenced once, each reference a file',
    () =>
      same(
        {
          pngs: pngs.length,
          named: pngs.every((file) => /^shadcn-[0-9a-f]{12}\.png$/.test(file)),
          references: [...references].sort(),
        },
        { pngs: 10, named: true, references: pngs },
      ),
  )

  await check('28. a: within 65,536 characters with 100 for each image', () => ({
    passed: body.length + IMAGE_ROOM * 10 <= COMMENT_LIMIT,
    detail: `${body.length} characters`,
  }))
}

async function checkCommentNothing() {
  const dir = commentInput(Object.fromEntries(EXAMPLES.map((name) => [name, exampleData(name)])))
  const { result, body, pngs, output } = changesComment(dir, ['--run-url', RUN_URL])

  await check('28. b: four reports without a change: the one sentence, no PNG, changed=false', () =>
    same(
      { status: result.status, stdout: result.stdout, body, pngs, output },
      {
        status: 0,
        stdout: 'Nothing changed in the four examples. Wrote comment/changes.md.\n',
        body: `${MARKER}\n\nNothing renders differently against the base any more.\n`,
        pngs: [],
        output: 'changed=false\n',
      },
    ),
  )
}

async function checkCommentLength() {
  const sizes = { 'react-browser': 2000, 'react-jsdom': 3000, shadcn: 4000, mui: 5000 }
  const dir = commentInput(
    Object.fromEntries(
      Object.entries(sizes).map(([name, size]) => [
        name,
        shotsReport({ different: 12, same: size }),
      ]),
    ),
  )

  const { result, body = '', pngs } = changesComment(dir, ['--run-url', RUN_URL])
  const references = imageReferences(body)

  await check('28. c: four crowded reports fit 65,536 characters with 100 for each image', () => ({
    passed: result.status === 0 && commentCost(body) <= COMMENT_LIMIT,
    detail: `${exitDetail(result)}, ${body.length} characters and ${references.length} images`,
  }))

  await check('28. c: every example keeps its heading, its sentence and an image', () =>
    same(
      EXAMPLES.map((name) => {
        const section = exampleSection(body, name) ?? ''
        const tests = sizes[name] + 12

        return {
          sentence: section.startsWith(
            `${tests} of ${tests} tests changed. 12 of the changed tests look different.\n`,
          ),
          image: references.some((file) => file.startsWith(`${name}-`)),
        }
      }),
      EXAMPLES.map(() => ({ sentence: true, image: true })),
    ),
  )

  await check('28. c: every reference has its file and every file is referenced', () =>
    same([...new Set(references)].sort(), pngs),
  )

  const small = shotsReport({ different: 1 })
  const mixed = commentInput({
    'react-browser': small,
    'react-jsdom': shotsReport({ different: 12, same: 3000 }),
    shadcn: shotsReport({ different: 12, same: 3000 }),
    mui: shotsReport({ different: 12, same: 3000 }),
  })

  const { body: mixedBody = '' } = changesComment(mixed)
  const smallBody = changesMarkdown(small)
    .slice(`${MARKER}\n\n`.length)
    .replace('](./000000000000.png)', '](./react-browser-000000000000.png)')

  await check(
    '28. c: a small report keeps its whole body, the others share what it leaves',
    () => ({
      passed:
        exampleSection(mixedBody, 'react-browser') === smallBody &&
        commentCost(mixedBody) <= COMMENT_LIMIT &&
        commentCost(mixedBody) > COMMENT_LIMIT - 2000,
      detail: `${commentCost(mixedBody)} characters with images, react-browser ${JSON.stringify(exampleSection(mixedBody, 'react-browser')?.slice(0, 300))}`,
    }),
  )
}

async function checkCommentSameId() {
  const dir = commentInput({
    'react-browser': shotsReport({ different: 1 }),
    'react-jsdom': shotsReport({ different: 1 }),
    shadcn: shotsReport(),
    mui: shotsReport(),
  })

  const { result, body = '', pngs } = changesComment(dir)

  await check('28. d: one image name in react-browser and react-jsdom gives two files', () =>
    same(
      { status: result.status, pngs, references: imageReferences(body) },
      {
        status: 0,
        pngs: ['react-browser-000000000000.png', 'react-jsdom-000000000000.png'],
        references: ['react-browser-000000000000.png', 'react-jsdom-000000000000.png'],
      },
    ),
  )
}

async function checkCommentErrors() {
  const nothing = shotsReport()
  const unsafe = shotsReport({ different: 1 })
  unsafe.tests[0].shot.file = '../evil.png'

  const reportFile = (dir, name) => join(dir, name, 'changes.json')
  const cases = [
    ['no mui/changes.json', 'mui', (dir) => rmSync(reportFile(dir, 'mui'))],
    ['a report that is not JSON', 'shadcn', (dir) => writeFileSync(reportFile(dir, 'shadcn'), '{')],
    [
      'a report of version 2',
      'react-jsdom',
      (dir) =>
        writeFileSync(reportFile(dir, 'react-jsdom'), JSON.stringify({ ...nothing, version: 2 })),
    ],
    [
      'an unsafe image name',
      'react-browser',
      (dir) => writeFileSync(reportFile(dir, 'react-browser'), JSON.stringify(unsafe)),
    ],
    [
      'a missing image',
      'mui',
      (dir) => writeFileSync(reportFile(dir, 'mui'), JSON.stringify(shotsReport({ different: 1 }))),
    ],
  ]

  for (const [label, name, spoil] of cases) {
    const dir = commentInput(Object.fromEntries(EXAMPLES.map((example) => [example, nothing])))
    spoil(dir)

    const { result, written } = changesComment(dir, ['--run-url', RUN_URL])

    await check(`28. e: ${label}: exit 1, stderr names ${name}, nothing written`, () => ({
      passed:
        result.status === 1 &&
        result.stderr.startsWith('changes-comment: ') &&
        result.stderr.includes(name) &&
        !written,
      detail: `${exitDetail(result)}, comment/ ${written ? 'written' : 'not written'}`,
    }))
  }
}

async function checkCommentTooMany() {
  const dir = commentInput(
    Object.fromEntries(EXAMPLES.map((name) => [name, shotsReport({ different: 13 })])),
  )

  const { result, written } = changesComment(dir, ['--run-url', RUN_URL])

  await check('28. f: 13 images in each example: exit 1, gh attaches 50, nothing written', () => ({
    passed:
      result.status === 1 &&
      result.stderr.startsWith('changes-comment: the comment shows 52 images') &&
      result.stderr.includes(' 50 ') &&
      !written,
    detail: `${exitDetail(result)}, comment/ ${written ? 'written' : 'not written'}`,
  }))
}

async function checkCommentPlain() {
  const dir = commentInput({
    'react-browser': shotsReport({ different: 1 }),
    'react-jsdom': shotsReport(),
    shadcn: shotsReport(),
    mui: shotsReport(),
  })

  const { result, body = '' } = changesComment(dir, [], { githubOutput: false })

  await check(
    '28. g: without GITHUB_OUTPUT and --run-url: exit 0 and an intro without a link',
    () =>
      same(
        { status: result.status, intro: introOf(body), link: body.includes('[The run]') },
        { status: 0, intro: `${INTRO} 1 of 4 examples changed.`, link: false },
      ),
  )
}

async function checkComment(shadcnShots) {
  await checkCommentExamples(shadcnShots)
  await checkCommentNothing()
  await checkCommentLength()
  await checkCommentSameId()
  await checkCommentErrors()
  await checkCommentTooMany()
  await checkCommentPlain()
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
  await checkShotFlags()
  await checkPlaywrightMissing()
  await checkShotGroups()
  await checkShotBudget()
  await checkShotFailure()
  await checkNothingLeft()
  await checkDeterminism()

  const shadcnShots = await checkShadcnShots()

  await checkComment(shadcnShots)
} catch (error) {
  failures++
  console.error(`FAIL  ${errorMessage(error)}`)
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
