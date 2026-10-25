/**
 * Guards the generated manifests against silent regressions: every test must
 * have a `render` frame with a named component, every component must have its
 * props docs, every asset must have been found, every font family that frames
 * use must be loaded, no frame may load a stylesheet from a remote host, the
 * plugin must have found no problem in the setup (`setupWarnings`), and the
 * reporter none reading the design-system foundations (`foundationsErrors`).
 * The manifest must also carry both font audit lists. Run after `pnpm build`.
 *
 * What the reporter and the recorder guarantee is checked too: every module
 * has a test, every test has a frame besides the closing one, and no closing
 * frame shows an empty page. Frames keep call order: their ids count up from
 * `f0`, and a closing frame is always a test's last. Every referenced
 * snapshot file must also exist and hold an rrweb serialized document whose
 * ids start at 1 and carry no `rootId`, and no two files may hold the same
 * DOM (compared without rrweb's node ids). No snapshot may hold a `<script>`
 * element or a `data-vite-dev-id` that is absolute or has a `..` segment, so
 * none names the machine that recorded it. `--structure-only` runs just these
 * guarantees and snapshot checks, which is what a real project can promise.
 * The full check also expects `at` never to decrease within a test. In a real
 * project, captures the test did not await can overlap and break that.
 *
 * Both modes also check the stores: every style chunk a snapshot's
 * `_cssText` refers to exists, no chunk in `styles/` is orphaned, and every
 * asset named in a snapshot, a chunk or the preview head (`manifest.head`) is
 * in `assets/`. So is every sibling name inside a reachable CSS asset,
 * transitively. Folders in the stores are not the reporter's and are ignored.
 * The full check also makes sure extraction is on: no snapshot inlines a sheet
 * of 256+ characters, and some snapshot refers to a chunk. It also makes sure
 * that the head and the reachable CSS assets point only at stored assets or
 * outside the project. The head is read without its comments, `<script>`
 * and `<style>` elements, split as the reporter splits it. `--require-fonts`
 * adds what react-browser and react-jsdom promise: the head links Google
 * Fonts, and a stored `.woff2` is reachable.
 *
 * The full check also holds a test to its name. A test named
 * `names Badge tone=danger …` must be documented under the registered
 * `Badge`, and both its component and its last render frame must have `tone`
 * set to `danger`. A manifest without such a test fails, so the rule always
 * checks something.
 *
 * Both modes check test ids: every `id` is 12 hex characters, no two tests
 * share one, and every test has a string `vitestId`. The full check also
 * recomputes each `id` from the module path, suite path, name and occurrence,
 * as the reporter does. Occurrences count every test the reporter saw, so
 * they may skip numbers but never go back.
 *
 * Both modes check that `manifest.generator` names a package and a version,
 * and the full check expects `@describe-me/vitest` at the version in
 * `packages/vitest/package.json`.
 *
 * Both modes check the hover and focus states of frames. A
 * `data-describe-me-states` value holds only `hover`, `focus`,
 * `focus-visible` and `focus-within`, each at most once, in that order. A
 * hover gesture frame is one whose label, or its part after the last ` · `
 * (where a `step()` took the frame over), starts with `hover(`,
 * `mouseEnter(`, `mouseOver(`, `pointerEnter(` or `pointerOver(`, in any
 * case, and an unhover frame one that starts with `unhover(`, `mouseLeave(`,
 * `mouseOut(`, `pointerLeave(` or `pointerOut(`. Within a test, no frame has
 * `hover` before its first hover gesture frame, or from an unhover frame
 * until the next hover gesture frame. Every ancestor of a hovered element, up
 * to `html`, is hovered too. At most one element has `focus`, never `html` or
 * `body`, `focus-visible` appears only with `focus`, and `focus-within` sits
 * on exactly the focused element and its ancestors. The full check also holds
 * named tests to the states their frames must show, per example directory. In
 * react-browser: the ghost button's hover, the disabled button's hover and
 * none after `unhover()`, a hover and then a click that focuses without
 * `focus-visible` and leaves no hover although the pointer stays on the
 * button, a hover before a double click, a triple click, `wheel()` and
 * `dropTo()` and none after each, a ring after `tab()`, and a search field
 * with focus inside its form. In react-jsdom: the hover of `hover()` and none
 * after `unhover()`, the hover of every enter and over event of `fireEvent`
 * and none after every leave and out event, in the function form too, a click
 * without `focus-visible`, a ring after `tab()` that a hover keeps and a click
 * ends along with the hover, then `keyboard()` and `type()` bringing it back
 * and `dblClick()`, `tripleClick()` and `pointer()` ending it with the hover,
 * `fireEvent.click` without any state, and `focus-visible` on a text field
 * that `type()` focuses and on a textarea and a contenteditable element after
 * a click, but not on an element whose contenteditable is false. A missing
 * test fails, as with the naming rule.
 *
 * Both modes check the sidebar groups. With `manifest.sidebar`,
 * `sidebar.groups` is a non-empty list of distinct paths, each a non-empty
 * list of non-empty strings. The list is depth first: the first path has one
 * segment, and the parent of every later path is a prefix of the path right
 * before it. Every module `group` is listed, and every listed path is a
 * module's group or a prefix of one. Without `manifest.sidebar`, no module
 * has a `group`. Both modes also hold the examples to their config, per
 * example directory: in react-browser, each test file of its
 * `sidebar.groups` is in the manifest with exactly its group, Naming.test.tsx
 * without one, any other module (such as a `bench/` one) without one, and
 * `sidebar.groups` is the list its config gives; in shadcn, the files of
 * `src/components/ui/` are under `Components/ui` and the signup card under
 * `Components`. react-jsdom and mui have no `sidebar` and no `group`. Any
 * other directory gets only the rules above.
 *
 * Usage: `node scripts/check-manifest.mjs [--structure-only] [--require-fonts] <path/to/manifest.json> [...more]`
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { cssReferences } from '../packages/core/dist/css-references.js'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'

const STYLE_PREFIX = 'describe-me-style:'
// A whole `_cssText` value, as packages/vitest/src/style-store.ts writes it. Inside a JSON
// string every `"` is escaped, so text that merely names a chunk does not match.
const STYLE_REFERENCE = /"_cssText":"describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)"/g
// The same pattern as ASSET_REFERENCE in packages/vitest/src/asset-store.ts.
const ASSET_REFERENCE = /describe-me-asset:([0-9a-f]{16}(?:\.[a-z0-9]+)?)/g
// The same pattern as ASSET_NAME in packages/vitest/src/css-asset-references.ts.
const ASSET_NAME = /^[0-9a-f]{16}(?:\.[a-z0-9]+)?$/
// A copy of MIN_EXTRACTED_LENGTH in packages/vitest/src/style-store.ts.
const MIN_EXTRACTED_LENGTH = 256

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
// Resolves protocol-relative head URLs, so their host can be read.
const HEAD_BASE_URL = 'https://head.invalid/'
// `href` and `src` values, double-quoted, single-quoted or bare. `data-src` is not `src`.
const HEAD_URL = /(?<![\w-])(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi
// The same pattern as RAW_TEXT in packages/vitest/src/rewrite-head-references.ts.
const RAW_TEXT =
  /<!--[\s\S]*?--!?>|<script\b[\s\S]*?<\/script\b[^>]*>|(<style\b[^>]*>)([\s\S]*?)(<\/style\b[^>]*>)/gi

// The same pattern as ABSOLUTE_PATH in packages/vitest/src/clean-snapshot.ts.
const ABSOLUTE_PATH = /^(?:[\\/]|[A-Za-z]:)/

const TEST_ID = /^[0-9a-f]{12}$/
// How far past the last occurrence of a name the next may be. The reporter leaves some tests out.
const MAX_OCCURRENCE_SKIP = 100

const GENERATOR_NAME = '@describe-me/vitest'
const generatorVersion = JSON.parse(
  readFileSync(new URL('../packages/vitest/package.json', import.meta.url), 'utf8'),
).version

const STRUCTURE_ONLY = '--structure-only'
const REQUIRE_FONTS = '--require-fonts'
const structureOnly = process.argv.includes(STRUCTURE_ONLY)
const requireFonts = process.argv.includes(REQUIRE_FONTS)
const paths = process.argv.slice(2).filter((arg) => arg !== STRUCTURE_ONLY && arg !== REQUIRE_FONTS)

if (paths.length === 0) {
  console.error(
    'usage: check-manifest [--structure-only] [--require-fonts] <path/to/manifest.json> [...more]',
  )

  process.exit(2)
}

function problemsIn(manifest) {
  const tests = manifest.modules.flatMap((module) => module.tests)
  const problems = []

  for (const test of tests) {
    if (!test.frames.some((frame) => frame.kind === 'render')) {
      problems.push(`${test.fullName}: no render frame`)
    }

    if (!test.component) {
      problems.push(`${test.fullName}: no component recorded`)
    }
  }

  if (Object.keys(manifest.components ?? {}).length === 0) {
    problems.push('manifest.components is empty')
  }

  const {
    setupWarnings,
    foundationsErrors,
    anonymous,
    undocumented,
    assetsMissing,
    fontsMissing,
    remoteStylesheets,
  } = manifestDiagnostics(manifest)

  for (const warning of setupWarnings) {
    problems.push(`setup: ${warning}`)
  }

  for (const error of foundationsErrors) {
    problems.push(`foundations: ${error}`)
  }

  for (const test of anonymous) {
    problems.push(`${test.fullName}: anonymous component`)
  }

  for (const component of undocumented) {
    problems.push(`${component.name}: no props docs (${component.tests} tests)`)
  }

  for (const path of assetsMissing) {
    problems.push(`${path}: asset not found`)
  }

  for (const font of fontsMissing) {
    problems.push(`${font.family}: font family used but never loaded (${font.tests} tests)`)
  }

  for (const stylesheet of remoteStylesheets) {
    problems.push(
      `${stylesheet.host}: frames load a remote stylesheet (${stylesheet.frames} frames)`,
    )
  }

  if (!Array.isArray(manifest.fontsMissing)) {
    problems.push('manifest.fontsMissing is not written')
  }

  if (!Array.isArray(manifest.remoteStylesheets)) {
    problems.push('manifest.remoteStylesheets is not written')
  }

  return problems
}

/** What the reporter guarantees: no module without tests, no test that recorded nothing. */
function emptinessProblemsIn(manifest) {
  const problems = []

  for (const module of manifest.modules) {
    if (module.tests.length === 0) {
      problems.push(`${module.id}: no tests`)
    }

    for (const test of module.tests) {
      if (!test.frames.some((frame) => frame.kind !== 'end')) {
        problems.push(`${test.fullName}: no frame besides the closing one`)
      }
    }
  }

  return problems
}

/** Frames keep call order: ids count up from `f0`, and nothing follows a closing frame. */
function orderProblemsIn(manifest) {
  const problems = []

  for (const test of manifest.modules.flatMap((module) => module.tests)) {
    const last = test.frames.length - 1

    test.frames.forEach((frame, i) => {
      if (frame.id !== `f${i}`) {
        problems.push(`${test.fullName}: frame ${i} has id ${frame.id}, expected f${i}`)
      }

      if (frame.kind === 'end' && i < last) {
        problems.push(`${test.fullName}: closing frame ${frame.id} is not the last frame`)
      }
    })
  }

  return problems
}

/** Not in `--structure-only`: captures a test did not await can overlap and finish out of order. */
function timeProblemsIn(manifest) {
  const problems = []

  for (const test of manifest.modules.flatMap((module) => module.tests)) {
    for (let i = 1; i < test.frames.length; i++) {
      const previous = test.frames[i - 1]
      const frame = test.frames[i]

      if (frame.at < previous.at) {
        problems.push(
          `${test.fullName}: frame ${frame.id} at ${frame.at} ms is earlier than ${previous.id} at ${previous.at} ms`,
        )
      }
    }
  }

  return problems
}

/** What every 0.5 manifest holds: a well-formed, unique `id` and a `vitestId` on each test. */
function idProblemsIn(manifest) {
  const problems = []
  const seen = new Set()

  for (const test of manifest.modules.flatMap((module) => module.tests)) {
    if (typeof test.id !== 'string' || !TEST_ID.test(test.id)) {
      problems.push(`${test.fullName}: id ${JSON.stringify(test.id)} is not 12 hex characters`)
    } else if (seen.has(test.id)) {
      problems.push(`${test.fullName}: id ${test.id} is not unique`)
    }

    seen.add(test.id)

    if (typeof test.vitestId !== 'string') {
      problems.push(`${test.fullName}: no vitestId`)
    }
  }

  return problems
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value !== ''
}

/** Every manifest since 0.10 names its project, from the package.json at or above the root. */
function projectProblemsIn(manifest) {
  return isNonEmptyString(manifest.project)
    ? []
    : [`manifest.project is ${JSON.stringify(manifest.project)}, expected the project's name`]
}

/** Every manifest since 0.5.1 names its writer. Only the full check knows which one it must be. */
function generatorProblemsIn(manifest) {
  const { generator } = manifest

  if (typeof generator !== 'object' || generator === null) {
    return ['manifest.generator is not written']
  }

  const problems = []

  if (!isNonEmptyString(generator.name)) {
    problems.push(`manifest.generator.name is ${JSON.stringify(generator.name)}`)
  }

  if (!isNonEmptyString(generator.version)) {
    problems.push(`manifest.generator.version is ${JSON.stringify(generator.version)}`)
  }

  if (structureOnly || problems.length > 0) {
    return problems
  }

  if (generator.name !== GENERATOR_NAME || generator.version !== generatorVersion) {
    problems.push(
      `manifest.generator is ${generator.name} ${generator.version}, expected ${GENERATOR_NAME} ${generatorVersion}`,
    )
  }

  return problems
}

/** The formula of `stableTestId` in packages/vitest/src/stable-test-id.ts. */
function stableTestId(moduleId, path, name, occurrence) {
  let input = [moduleId, ...path, name].join('\0')
  if (occurrence > 1) {
    input += `\0${occurrence}`
  }

  return createHash('sha1').update(input).digest('hex').slice(0, 12)
}

/**
 * The occurrence after `previous` that gives the test its `id`, or undefined.
 * Occurrences count every test the reporter saw, so they may skip numbers but
 * never go back.
 */
function occurrenceOf(test, moduleId, previous) {
  for (let occurrence = previous + 1; occurrence <= previous + MAX_OCCURRENCE_SKIP; occurrence++) {
    if (test.id === stableTestId(moduleId, test.path, test.name, occurrence)) {
      return occurrence
    }
  }

  return undefined
}

/** Each `id` follows the formula, with an occurrence above the last one of the same name. */
function stableIdProblemsIn(manifest) {
  const problems = []

  for (const module of manifest.modules) {
    const moduleId = module.id.split('\\').join('/')
    const seen = new Map()

    for (const test of module.tests) {
      const key = [...test.path, test.name].join('\0')
      const previous = seen.get(key) ?? 0
      const occurrence = occurrenceOf(test, moduleId, previous)

      if (occurrence !== undefined) {
        seen.set(key, occurrence)
        continue
      }

      const expected = stableTestId(moduleId, test.path, test.name, previous + 1)
      problems.push(`${test.fullName}: id ${test.id}, expected ${expected}`)
      seen.set(key, previous + 1)
    }
  }

  return problems
}

/** rrweb node types, from `NodeType` in rrweb-snapshot. */
const ELEMENT_NODE = 2
const TEXT_NODE = 3

function findBody(node) {
  if (node.type === ELEMENT_NODE && node.tagName === 'body') {
    return node
  }

  for (const child of childrenOf(node)) {
    const body = findBody(child)

    if (body) {
      return body
    }
  }

  return undefined
}

function isBareDiv(node) {
  return node.tagName === 'div' && Object.keys(node.attributes ?? {}).length === 0
}

/** Any text that is not whitespace, or any element but a `div` without attributes. */
function showsSomething(node) {
  if (node.type === TEXT_NODE) {
    return (node.textContent ?? '').trim() !== ''
  }

  if (node.type === ELEMENT_NODE && !isBareDiv(node)) {
    return true
  }

  return childrenOf(node).some(showsSomething)
}

/** The rule of `pageHasContent()` in core, applied to a serialized document. */
function isEmptyPage(serialized) {
  const body = findBody(serialized)

  return body === undefined || !childrenOf(body).some(showsSomething)
}

/** A snapshot file's document, or null when it is missing or broken: `inspectSnapshot` reports those. */
function readSnapshot(abs) {
  try {
    return JSON.parse(readFileSync(abs, 'utf8'))
  } catch {
    return null
  }
}

/** What the recorder guarantees: the closing frame is skipped when the page shows nothing. */
function closingFrameProblemsIn(manifest, manifestPath) {
  const problems = []

  for (const module of manifest.modules) {
    for (const test of module.tests) {
      for (const frame of test.frames) {
        if (frame.kind !== 'end') {
          continue
        }

        const serialized = readSnapshot(resolve(dirname(manifestPath), frame.snapshot))

        if (isSerializedDocument(serialized) && isEmptyPage(serialized)) {
          problems.push(`${test.fullName}: closing frame shows an empty page`)
        }
      }
    }
  }

  return problems
}

/** Unique snapshot paths the manifest's frames point at, relative to the manifest. */
function snapshotFilesOf(manifest) {
  const files = new Set()
  for (const module of manifest.modules) {
    for (const test of module.tests) {
      for (const frame of test.frames) {
        files.add(frame.snapshot)
      }
    }
  }

  return [...files]
}

function isSerializedDocument(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.type === 0 &&
    Array.isArray(value.childNodes)
  )
}

function childrenOf(node) {
  return Array.isArray(node.childNodes) ? node.childNodes : []
}

function isScript(node) {
  return (
    node.type === 2 && typeof node.tagName === 'string' && node.tagName.toLowerCase() === 'script'
  )
}

/** What the reporter removes before it stores a snapshot: `<script>` elements and machine paths. */
function machineTraces(node, traces = { scripts: 0, devIds: [] }) {
  if (isScript(node)) {
    traces.scripts++
  }

  const devId = node.attributes?.['data-vite-dev-id']

  if (
    typeof devId === 'string' &&
    (ABSOLUTE_PATH.test(devId) || devId.split(/[\\/]/).includes('..'))
  ) {
    traces.devIds.push(devId)
  }

  for (const child of childrenOf(node)) {
    machineTraces(child, traces)
  }

  return traces
}

function countRootIds(node) {
  let count = Object.hasOwn(node, 'rootId') ? 1 : 0
  for (const child of childrenOf(node)) {
    count += countRootIds(child)
  }

  return count
}

/**
 * rrweb's `id` and `rootId` number the capture, not the DOM. Drop them from the
 * serialized nodes only: an element's `attributes.id` is part of the DOM.
 */
function stripNodeIds(node) {
  delete node.id
  delete node.rootId
  for (const child of childrenOf(node)) {
    stripNodeIds(child)
  }
}

function domKey(serialized) {
  stripNodeIds(serialized)

  return createHash('sha1').update(JSON.stringify(serialized)).digest('hex')
}

/** Problems of one snapshot file, and its DOM key when it is a readable document. */
function inspectSnapshot(file, abs) {
  if (!existsSync(abs)) {
    return { problems: [`${file}: snapshot file missing`] }
  }

  let serialized
  try {
    serialized = JSON.parse(readFileSync(abs, 'utf8'))
  } catch {
    return { problems: [`${file}: not valid JSON`] }
  }

  if (!isSerializedDocument(serialized)) {
    return { problems: [`${file}: not an rrweb serialized document`] }
  }

  const problems = []
  const rootIds = countRootIds(serialized)
  if (rootIds > 0) {
    problems.push(`${file}: ${rootIds} node(s) carry rootId`)
  }

  if (serialized.id !== 1) {
    problems.push(`${file}: root node id is ${serialized.id}, expected 1`)
  }

  const traces = machineTraces(serialized)

  if (traces.scripts > 0) {
    problems.push(`${file}: ${traces.scripts} <script> element(s)`)
  }

  for (const devId of traces.devIds) {
    problems.push(`${file}: data-vite-dev-id ${devId} is absolute or has a .. segment`)
  }

  return { problems, key: domKey(serialized) }
}

function snapshotProblemsIn(manifest, manifestPath) {
  const files = snapshotFilesOf(manifest)
  const firstFileByKey = new Map()
  const problems = []

  for (const file of files) {
    const inspected = inspectSnapshot(file, resolve(dirname(manifestPath), file))
    problems.push(...inspected.problems)

    if (inspected.key === undefined) {
      continue
    }

    const first = firstFileByKey.get(inspected.key)
    if (first) {
      problems.push(`${file}: same DOM as ${first}`)
      continue
    }

    firstFileByKey.set(inspected.key, file)
  }

  return { files, problems }
}

/**
 * The entries in `dir` that are not folders, as the stores' GC sees them.
 * Older output has no `styles/`, which counts as empty.
 */
function filesIn(dir) {
  if (!existsSync(dir)) {
    return []
  }

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => entry.name)
}

function textsOf(outDir, files) {
  const texts = new Map()
  for (const file of files) {
    const abs = resolve(outDir, file)
    if (existsSync(abs)) {
      texts.set(file, readFileSync(abs, 'utf8'))
    }
  }

  return texts
}

/** Each chunk (`<hash>.css`) a `_cssText` value refers to, with the first file that does. */
function styleChunksIn(texts) {
  const chunks = new Map()
  for (const [file, text] of texts) {
    for (const match of text.matchAll(STYLE_REFERENCE)) {
      for (const hash of match[1].split('+')) {
        if (!chunks.has(`${hash}.css`)) {
          chunks.set(`${hash}.css`, file)
        }
      }
    }
  }

  return chunks
}

function assetProblemsIn(outDir, texts) {
  const stored = new Set(filesIn(join(outDir, 'assets')))
  const problems = new Set()
  for (const [file, text] of texts) {
    for (const match of text.matchAll(ASSET_REFERENCE)) {
      if (!stored.has(match[1])) {
        problems.add(`${file}: asset assets/${match[1]} missing`)
      }
    }
  }

  return [...problems]
}

/** Remote, protocol-relative, `data:`, `describe-me-asset:` and `#fragment` URLs, or none. */
function isExternalUrl(url) {
  return url === '' || url.startsWith('#') || url.startsWith('//') || URL_SCHEME.test(url)
}

/**
 * Follows the bare sibling names the asset store writes into copied CSS, from
 * the assets that the given texts name. Returns every stored asset reached,
 * each sibling that is missing, and each target that still points into the
 * project, which only the full check reports.
 */
function copiedCssIn(outDir, texts) {
  const stored = new Set(filesIn(join(outDir, 'assets')))
  const reached = new Set()
  const pending = []
  const missing = []
  const projectUrls = []

  const reach = (name) => {
    if (stored.has(name) && !reached.has(name)) {
      reached.add(name)
      pending.push(name)
    }
  }

  for (const [, text] of texts) {
    for (const match of text.matchAll(ASSET_REFERENCE)) {
      reach(match[1])
    }
  }

  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (!name.endsWith('.css')) {
      continue
    }

    for (const { url } of cssReferences(readFileSync(join(outDir, 'assets', name), 'utf8'))) {
      const target = url.split(/[?#]/)[0]

      if (ASSET_NAME.test(target)) {
        if (!stored.has(target)) {
          missing.push(`assets/${name}: asset assets/${target} missing`)
        }

        reach(target)
      } else if (!isExternalUrl(url)) {
        projectUrls.push(`assets/${name}: ${url} still points into the project`)
      }
    }
  }

  return { reached, missing, projectUrls }
}

function urlsIn(html) {
  return Array.from(html.matchAll(HEAD_URL), (match) => match[1] ?? match[2] ?? match[3])
}

/**
 * The `href` and `src` values the reporter rewrites: the text between comments,
 * `<script>` and `<style>` elements, split as `rewriteHeadReferences()` splits it.
 */
function headUrlsOf(manifest) {
  const head = manifest.head ?? ''
  const urls = []
  let copied = 0

  for (const match of head.matchAll(RAW_TEXT)) {
    urls.push(...urlsIn(head.slice(copied, match.index)))
    copied = match.index + match[0].length
  }

  return [...urls, ...urlsIn(head.slice(copied))]
}

/** Not in `--structure-only`: the head must name stored assets or point outside the project. */
function headProblemsIn(manifest) {
  return headUrlsOf(manifest)
    .filter((url) => !isExternalUrl(url))
    .map((url) => `manifest.head: ${url} still points into the project`)
}

function hostOf(url) {
  return URL.canParse(url, HEAD_BASE_URL) ? new URL(url, HEAD_BASE_URL).hostname : ''
}

/** `--require-fonts`: react-browser and react-jsdom load Inter from Google Fonts and Lora from a local file. */
function fontProblemsIn(manifest, reached) {
  const problems = []

  if (!headUrlsOf(manifest).some((url) => hostOf(url) === 'fonts.googleapis.com')) {
    problems.push('manifest.head does not link fonts.googleapis.com')
  }

  if (![...reached].some((name) => name.endsWith('.woff2'))) {
    problems.push('no .woff2 in assets/ is reachable from the head, a snapshot or a style chunk')
  }

  return problems
}

/** Missing snapshot files are left to the snapshot checks. */
function storeProblemsIn(manifest, manifestPath) {
  const outDir = dirname(manifestPath)
  const snapshots = textsOf(outDir, snapshotFilesOf(manifest))
  const referenced = styleChunksIn(snapshots)
  const stored = new Set(filesIn(join(outDir, 'styles')))
  const problems = []

  for (const [chunk, file] of referenced) {
    if (!stored.has(chunk)) {
      problems.push(`${file}: style chunk styles/${chunk} missing`)
    }
  }

  for (const chunk of stored) {
    if (!referenced.has(chunk)) {
      problems.push(`styles/${chunk}: no snapshot refers to it`)
    }
  }

  const chunkFiles = [...referenced.keys()].map((chunk) => `styles/${chunk}`)
  const head = typeof manifest.head === 'string' ? [['manifest.head', manifest.head]] : []
  const texts = [...snapshots, ...textsOf(outDir, chunkFiles), ...head]
  const copiedCss = copiedCssIn(outDir, texts)
  problems.push(...assetProblemsIn(outDir, texts), ...copiedCss.missing)

  return { snapshots, chunks: referenced.size, copiedCss, problems }
}

function inlinedSheetLengths(node, lengths = []) {
  const cssText = node.attributes?._cssText
  if (
    typeof cssText === 'string' &&
    cssText.length >= MIN_EXTRACTED_LENGTH &&
    !cssText.startsWith(STYLE_PREFIX)
  ) {
    lengths.push(cssText.length)
  }

  for (const child of childrenOf(node)) {
    inlinedSheetLengths(child, lengths)
  }

  return lengths
}

/** Not in `--structure-only`: a filtered run after an upgrade can keep older snapshots. */
function extractionProblemsIn(store) {
  const problems = []
  for (const [file, json] of store.snapshots) {
    let serialized
    try {
      serialized = JSON.parse(json)
    } catch {
      continue
    }

    if (!isSerializedDocument(serialized)) {
      continue
    }

    for (const length of inlinedSheetLengths(serialized)) {
      problems.push(`${file}: inlines a stylesheet of ${length} characters`)
    }
  }

  if (store.chunks === 0) {
    problems.push('no snapshot refers to a style chunk')
  }

  return problems
}

const STATES_ATTRIBUTE = 'data-describe-me-states'
// The order of PSEUDO_STATES_ATTRIBUTE in packages/core/src/types.ts.
const STATE_ORDER = ['hover', 'focus', 'focus-visible', 'focus-within']
// Labels of the frames whose gesture starts or ends a hover, in lower case.
const HOVER_LABELS = ['hover(', 'mouseenter(', 'mouseover(', 'pointerenter(', 'pointerover(']
const UNHOVER_LABELS = ['unhover(', 'mouseleave(', 'mouseout(', 'pointerleave(', 'pointerout(']

/**
 * A named case of the react-jsdom test that fires every hover event of
 * `fireEvent`: the frame of an enter or over event hovers the button, and the
 * frame of a leave or out event has no hover.
 */
function fireEventHoverCase([frame, hovered]) {
  const test = 'Disclosure > highlights the button on mouseEnter'

  return hovered
    ? { test, frame, element: 'button', has: ['hover'] }
    : { test, frame, nowhere: ['hover'] }
}

// The steps of the react-browser spinner test after its click: the frame, which one of those
// that start alike, and whether it hovers. A double and a triple click, a wheel and a drop end
// a hover, although the pointer stays on the button.
const SPINNER_STEPS = [
  ['hover(', 1, true],
  ['dblClick(', 1, false],
  ['hover(', 2, true],
  ['tripleClick(', 1, false],
  ['hover(', 3, true],
  ['wheel(', 1, false],
  ['hover(', 4, true],
  ['dropTo(', 1, false],
]

/** A named case of one step of SPINNER_STEPS. */
function spinnerStepCase([frame, nth, hovered]) {
  const test = 'Button > states > shows a spinner while loading and swallows clicks'

  return hovered
    ? { test, frame, nth, element: 'button', has: ['hover'] }
    : { test, frame, nth, nowhere: ['hover'] }
}

// The steps of the react-jsdom keyboard test after its first click: the frame, which one of
// those that start alike, whether the button keeps its ring, and whether it is hovered. A
// keyboard gesture brings the ring back, and each pointer gesture ends the ring and the hover.
const KEYBOARD_STEPS = [
  ['keyboard(', 1, true, false],
  ['hover(', 2, true, true],
  ['dblClick(', 1, false, false],
  ['type(', 1, true, false],
  ['hover(', 3, true, true],
  ['tripleClick(', 1, false, false],
  ['keyboard(', 2, true, false],
  ['hover(', 4, true, true],
  ['pointer(', 1, false, false],
]

/** A named case of one step of KEYBOARD_STEPS. */
function keyboardStepCase([frame, nth, ring, hovered]) {
  const states = ring ? ['focus', 'focus-visible', 'focus-within'] : ['focus', 'focus-within']
  const testCase = {
    test: 'Disclosure > shows a focus ring from the keyboard',
    frame,
    nth,
    element: 'button',
    has: hovered ? ['hover', ...states] : states,
    lacks: ring ? [] : ['focus-visible'],
  }

  return hovered ? testCase : { ...testCase, nowhere: ['hover'] }
}

// The frames after the first `mouseEnter(`, and whether each hovers. The last two are the
// function form, `fireEvent(element, new MouseEvent('mouseover'))`.
const FIRE_EVENT_HOVERS = [
  ['mouseLeave(', false],
  ['mouseOver(', true],
  ['mouseOut(', false],
  ['pointerEnter(', true],
  ['pointerLeave(', false],
  ['pointerOver(', true],
  ['pointerOut(', false],
  ['mouseover(', true],
  ['mouseout(', false],
]

/**
 * What the full check expects of named tests, per example directory: the
 * frame whose label starts with `frame`, the first such frame or the `nth`,
 * the first element of the frame with states that matches `element` (a tag,
 * or a tag with one attribute), the states it `has` and `lacks`, and the
 * states no element of the frame has. A `stateless` test has no state in any
 * frame.
 */
const STATE_CASES = {
  'react-browser': [
    {
      test: 'Button > states > highlights a ghost button on hover',
      frame: 'hover(',
      element: 'button',
      has: ['hover'],
      nowhere: ['focus'],
    },
    { test: 'Button > states > is disabled', frame: 'hover(', element: 'button', has: ['hover'] },
    { test: 'Button > states > is disabled', frame: 'unhover(', nowhere: ['hover'] },
    {
      test: 'Button > states > calls onClick when enabled',
      frame: 'hover(',
      element: 'button',
      has: ['hover'],
    },
    {
      test: 'Button > states > calls onClick when enabled',
      frame: 'click(',
      element: 'button',
      has: ['focus', 'focus-within'],
      lacks: ['focus-visible'],
      nowhere: ['hover'],
    },
    {
      test: 'Button > states > shows a focus ring from the keyboard',
      frame: 'tab(',
      element: 'button',
      has: ['focus', 'focus-visible', 'focus-within'],
    },
    ...SPINNER_STEPS.map(spinnerStepCase),
    {
      test: 'SearchBox > outlines the field while it has focus',
      frame: 'fill(',
      element: 'input',
      has: ['focus', 'focus-visible', 'focus-within'],
    },
    {
      test: 'SearchBox > outlines the field while it has focus',
      frame: 'fill(',
      element: 'form',
      has: ['focus-within'],
    },
  ],
  'react-jsdom': [
    {
      test: 'Disclosure > highlights the button on hover',
      frame: 'hover(',
      element: 'button',
      has: ['hover'],
      nowhere: ['focus'],
    },
    { test: 'Disclosure > highlights the button on hover', frame: 'unhover(', nowhere: ['hover'] },
    {
      test: 'Disclosure > highlights the button on mouseEnter',
      frame: 'mouseEnter(',
      element: 'button',
      has: ['hover'],
    },
    ...FIRE_EVENT_HOVERS.map(fireEventHoverCase),
    {
      test: 'Disclosure > opens through the direct API',
      frame: 'click(',
      element: 'button',
      has: ['focus', 'focus-within'],
      lacks: ['focus-visible'],
      nowhere: ['hover'],
    },
    {
      test: 'Disclosure > shows a focus ring from the keyboard',
      frame: 'tab(',
      element: 'button',
      has: ['focus', 'focus-visible', 'focus-within'],
    },
    {
      test: 'Disclosure > shows a focus ring from the keyboard',
      frame: 'hover(',
      element: 'button',
      has: ['hover', 'focus', 'focus-visible', 'focus-within'],
    },
    {
      test: 'Disclosure > shows a focus ring from the keyboard',
      frame: 'click(',
      element: 'button',
      has: ['focus', 'focus-within'],
      lacks: ['focus-visible'],
      nowhere: ['hover'],
    },
    ...KEYBOARD_STEPS.map(keyboardStepCase),
    { test: 'Disclosure > opens with fireEvent', stateless: true },
    {
      test: 'TextField > shows focus while typing',
      frame: 'type(',
      element: 'input',
      has: ['focus', 'focus-visible', 'focus-within'],
    },
    {
      test: 'TextField > shows focus while typing',
      frame: 'click(textarea',
      element: 'textarea',
      has: ['focus', 'focus-visible', 'focus-within'],
    },
    {
      test: 'TextField > shows focus while typing',
      frame: 'click(textbox "Notes"',
      element: 'div[aria-label="Notes"]',
      has: ['focus', 'focus-visible', 'focus-within'],
    },
    {
      test: 'TextField > shows focus while typing',
      frame: 'click(textbox "Read only"',
      element: 'div[aria-label="Read only"]',
      has: ['focus', 'focus-within'],
      lacks: ['focus-visible'],
    },
  ],
}

/** Each element of a serialized tree with states: its node, its value and its element ancestors. */
function markedElementsIn(node, ancestors = [], marked = []) {
  const isElement = node.type === ELEMENT_NODE
  const value = isElement ? node.attributes?.[STATES_ATTRIBUTE] : undefined

  if (value !== undefined) {
    marked.push({ node, value, ancestors: [...ancestors] })
  }

  if (isElement) {
    ancestors.push(node)
  }

  for (const child of childrenOf(node)) {
    markedElementsIn(child, ancestors, marked)
  }

  if (isElement) {
    ancestors.pop()
  }

  return marked
}

/** Why a value breaks the format of `data-describe-me-states`, or null. */
function stateValueProblem(value) {
  if (typeof value !== 'string') {
    return `is ${JSON.stringify(value)}, not a string`
  }

  const order = value.split(' ').map((name) => STATE_ORDER.indexOf(name))

  if (order.includes(-1)) {
    return `"${value}" names a state other than ${STATE_ORDER.join(', ')}`
  }

  if (order.some((index, i) => i > 0 && index <= order[i - 1])) {
    return `"${value}" repeats a state or leaves the order ${STATE_ORDER.join(' ')}`
  }

  return null
}

/** The states of one frame's snapshot, element by element, and what breaks the format. */
function frameStates(serialized) {
  const states = new Map()
  const problems = []

  for (const { node, value, ancestors } of markedElementsIn(serialized)) {
    const problem = stateValueProblem(value)

    if (problem) {
      problems.push(`<${node.tagName}> ${STATES_ATTRIBUTE} ${problem}`)
    } else {
      states.set(node, { names: value.split(' '), ancestors })
    }
  }

  return { states, problems }
}

function hasState(states, node, state) {
  return states.get(node)?.names.includes(state) ?? false
}

/** Hover covers whole chains, and focus one element, with `focus-within` on it and its ancestors. */
function frameRuleProblems(states) {
  const problems = []
  const marked = [...states]
  const focused = marked.filter(([node]) => hasState(states, node, 'focus'))

  for (const [node, { names, ancestors }] of marked) {
    const unhovered = ancestors.find((ancestor) => !hasState(states, ancestor, 'hover'))

    if (names.includes('hover') && unhovered) {
      problems.push(`<${node.tagName}> has hover, but its ancestor <${unhovered.tagName}> has not`)
    }

    if (names.includes('focus-visible') && !names.includes('focus')) {
      problems.push(`<${node.tagName}> has focus-visible without focus`)
    }
  }

  if (focused.length > 1) {
    return [...problems, `${focused.length} elements have focus`]
  }

  const [node, mark] = focused[0] ?? []

  if (node && ['html', 'body'].includes(node.tagName)) {
    problems.push(`<${node.tagName}> has focus`)
  }

  const within = new Set(node ? [node, ...mark.ancestors] : [])

  for (const element of new Set([...within, ...states.keys()])) {
    if (hasState(states, element, 'focus-within') !== within.has(element)) {
      problems.push(
        `<${element.tagName}> ${within.has(element) ? 'lacks' : 'has'} focus-within, expected it on the focused element and its ancestors only`,
      )
    }
  }

  return problems
}

/** Whether a frame's gesture starts a hover, ends one, or neither. */
function hoverGestureOf(label) {
  const texts = [label, label.split(' · ').at(-1)].map((text) => text.toLowerCase())
  const startsWithOne = (prefixes) =>
    texts.some((text) => prefixes.some((prefix) => text.startsWith(prefix)))

  if (startsWithOne(HOVER_LABELS)) {
    return 'hover'
  }

  return startsWithOne(UNHOVER_LABELS) ? 'unhover' : null
}

// `tag` or `tag[attribute="value"]`.
const ELEMENT_SPEC = /^([a-z][a-z0-9-]*)(?:\[([\w-]+)="([^"]*)"\])?$/

/** Whether a serialized node is the element that a case's `element` names. */
function isCaseElement(node, spec) {
  const [, tag, attribute, value] = ELEMENT_SPEC.exec(spec)

  return node.tagName === tag && (attribute === undefined || node.attributes?.[attribute] === value)
}

/** The `nth` frame of a test, from 1, whose label or its part after the last ` · ` starts with `prefix`. */
function nthFrame(test, prefix, nth = 1) {
  const frames = test.frames.filter((candidate) => {
    const texts = [candidate.label, candidate.label.split(' · ').at(-1)]

    return texts.some((text) => text.startsWith(prefix))
  })

  return frames[nth - 1]
}

/** The named test's problem with its frame, or null. */
function stateCaseProblem(testCase, test, statesOfFrame) {
  if (testCase.stateless) {
    const shown = test.frames.find((frame) => statesOfFrame(frame).size > 0)

    return shown ? `frame ${shown.id} (${shown.label}) has states, expected none` : null
  }

  const frame = nthFrame(test, testCase.frame, testCase.nth)

  if (!frame) {
    return `no frame ${testCase.nth ?? 1} that starts with ${testCase.frame}`
  }

  const states = statesOfFrame(frame)
  const element = testCase.element
    ? [...states.keys()].find((node) => isCaseElement(node, testCase.element))
    : undefined

  const names = element ? states.get(element).names : []
  const where = `frame ${frame.id} (${frame.label})`
  const missing = (testCase.has ?? []).filter((state) => !names.includes(state))
  const extra = (testCase.lacks ?? []).filter((state) => names.includes(state))
  const anywhere = (testCase.nowhere ?? []).filter((state) =>
    [...states.keys()].some((node) => hasState(states, node, state)),
  )

  if (missing.length > 0 || extra.length > 0) {
    const expected = [
      missing.length > 0 ? `with ${missing.join(' ')}` : '',
      extra.length > 0 ? `without ${extra.join(' ')}` : '',
    ].filter(Boolean)

    return `${where}: <${testCase.element}> has "${names.join(' ')}", expected it ${expected.join(' and ')}`
  }

  return anywhere.length > 0
    ? `${where}: an element has ${anywhere.join(' ')}, expected none`
    : null
}

/** Not in `--structure-only`: the named tests of the example the manifest belongs to. */
function stateCaseProblems(manifest, path, statesOfFrame) {
  const example = basename(dirname(dirname(resolve(path))))
  const tests = manifest.modules.flatMap((module) => module.tests)
  const problems = []

  for (const testCase of STATE_CASES[example] ?? []) {
    const test = tests.find((candidate) => candidate.fullName === testCase.test)

    if (!test) {
      problems.push(`${testCase.test}: no such test, so its hover and focus went unchecked`)
      continue
    }

    const problem = stateCaseProblem(testCase, test, statesOfFrame)

    if (problem) {
      problems.push(`${testCase.test}: ${problem}`)
    }
  }

  return problems
}

/**
 * The hover and focus states of every frame. Returns the problems and how
 * many frames have states. Snapshot files that are missing or broken are left
 * to the snapshot checks.
 */
function pseudoStateProblemsIn(manifest, path) {
  const byFile = new Map()
  const problems = []
  let frames = 0

  const statesOfFrame = (frame) => {
    if (!byFile.has(frame.snapshot)) {
      const serialized = readSnapshot(resolve(dirname(path), frame.snapshot))
      const read = isSerializedDocument(serialized)
        ? frameStates(serialized)
        : { states: new Map(), problems: [] }

      byFile.set(frame.snapshot, { ...read, rules: frameRuleProblems(read.states) })
    }

    return byFile.get(frame.snapshot).states
  }

  for (const test of manifest.modules.flatMap((module) => module.tests)) {
    let hovering = false

    for (const frame of test.frames) {
      const states = statesOfFrame(frame)
      const read = byFile.get(frame.snapshot)
      const gesture = hoverGestureOf(frame.label)
      const where = `${test.fullName}: frame ${frame.id} (${frame.label})`

      hovering = gesture === null ? hovering : gesture === 'hover'

      for (const problem of [...read.problems, ...read.rules]) {
        problems.push(`${where}: ${problem}`)
      }

      if (states.size > 0) {
        frames++
      }

      if (!hovering && [...states.keys()].some((node) => hasState(states, node, 'hover'))) {
        problems.push(
          `${where}: has hover, but no hover gesture frame comes before it since the last unhover`,
        )
      }
    }
  }

  if (!structureOnly) {
    problems.push(...stateCaseProblems(manifest, path, statesOfFrame))
  }

  return { problems, frames }
}

/**
 * The groups each example's config gives, per example directory: the group of
 * every listed module, `null` for one without, and `sidebar.groups`, `null`
 * for no `sidebar`. A module that is not listed has no group.
 */
const SIDEBAR_GROUPS = {
  'react-browser': {
    modules: {
      'src/Button.test.tsx': ['Components'],
      'src/Chip.test.tsx': ['Components'],
      'src/Counter.test.tsx': ['Components', 'Inputs'],
      'src/Menu.test.tsx': ['Components'],
      'src/Naming.test.tsx': null,
      'src/Postcard.test.tsx': ['Postcard'],
      'src/SearchBox.test.tsx': ['Components', 'Inputs'],
      'src/StyledText.test.tsx': ['Styles'],
    },
    groups: [['Components'], ['Components', 'Inputs'], ['Postcard'], ['Styles']],
  },
  'react-jsdom': { modules: {}, groups: null },
  shadcn: {
    modules: {
      'src/components/signup-card.test.tsx': ['Components'],
      'src/components/ui/button.test.tsx': ['Components', 'ui'],
      'src/components/ui/card.test.tsx': ['Components', 'ui'],
      'src/components/ui/feedback.test.tsx': ['Components', 'ui'],
      'src/components/ui/form-controls.test.tsx': ['Components', 'ui'],
    },
    groups: [['Components'], ['Components', 'ui']],
  },
  mui: { modules: {}, groups: null },
}

function isGroupPath(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}

function isPrefix(prefix, path) {
  return prefix.length <= path.length && prefix.every((name, i) => path[i] === name)
}

/** What any manifest promises about its groups, with the paths it lists if they are well formed. */
function sidebarShapeProblems(manifest) {
  const grouped = manifest.modules.filter((module) => 'group' in module)

  if (manifest.sidebar === undefined) {
    return grouped.map((module) => `${module.id}: has a group, but the manifest has no sidebar`)
  }

  const groups = manifest.sidebar?.groups

  if (!Array.isArray(groups) || groups.length === 0 || !groups.every(isGroupPath)) {
    return [`sidebar.groups is not a non-empty list of paths: ${JSON.stringify(groups)}`]
  }

  const problems = []
  const keys = groups.map((path) => JSON.stringify(path))

  for (const [i, key] of keys.entries()) {
    if (keys.indexOf(key) !== i) {
      problems.push(`sidebar.groups lists ${key} twice`)
    }
  }

  if (groups[0].length !== 1) {
    problems.push(`sidebar.groups starts with ${keys[0]}, expected a top-level group`)
  }

  for (let i = 1; i < groups.length; i++) {
    if (!isPrefix(groups[i].slice(0, -1), groups[i - 1])) {
      problems.push(`sidebar.groups lists ${keys[i]} right after ${keys[i - 1]}, not depth first`)
    }
  }

  for (const module of grouped) {
    if (!isGroupPath(module.group) || !keys.includes(JSON.stringify(module.group))) {
      problems.push(`${module.id}: group ${JSON.stringify(module.group)} is not in sidebar.groups`)
    }
  }

  for (const [i, path] of groups.entries()) {
    if (!grouped.some((module) => isPrefix(path, module.group ?? []))) {
      problems.push(`sidebar.groups lists ${keys[i]}, which holds no module`)
    }
  }

  return problems
}

/** The groups of the example the manifest belongs to, as its config gives them. */
function sidebarCaseProblems(manifest, path) {
  const expected = SIDEBAR_GROUPS[basename(dirname(dirname(resolve(path))))]

  if (expected === undefined) {
    return []
  }

  const problems = []
  const groupOf = (module) => JSON.stringify(module.group ?? null)

  for (const [id, group] of Object.entries(expected.modules)) {
    const module = manifest.modules.find((candidate) => candidate.id === id)

    if (!module) {
      problems.push(`${id}: not in the manifest, so its sidebar group went unchecked`)
    } else if (groupOf(module) !== JSON.stringify(group)) {
      problems.push(`${id}: group ${groupOf(module)}, expected ${JSON.stringify(group)}`)
    }
  }

  for (const module of manifest.modules) {
    if (!(module.id in expected.modules) && 'group' in module) {
      problems.push(`${module.id}: group ${groupOf(module)}, expected none`)
    }
  }

  const groups = JSON.stringify(manifest.sidebar?.groups ?? null)

  if (groups !== JSON.stringify(expected.groups)) {
    problems.push(`sidebar.groups is ${groups}, expected ${JSON.stringify(expected.groups)}`)
  }

  return problems
}

function sidebarProblemsIn(manifest, path) {
  return [...sidebarShapeProblems(manifest), ...sidebarCaseProblems(manifest, path)]
}

// `names Badge tone=danger inside a ThemeProvider`: the component, then the rest of the name.
const NAMING_TEST = /^names ([A-Z]\S*)(.*)$/

/** Not in `--structure-only`: a `names <Component> key=value …` test shows what its name says. */
function namingProblemsIn(manifest) {
  const problems = []
  let checked = 0

  for (const test of manifest.modules.flatMap((module) => module.tests)) {
    const match = NAMING_TEST.exec(test.name)

    if (!match) {
      continue
    }

    checked++
    const [, expected, rest] = match
    const { component } = test

    if (component?.name !== expected || !component.file) {
      problems.push(
        `${test.fullName}: documented as ${component?.name} (${component?.file ?? 'no file'}), expected the registered ${expected}`,
      )
    }

    const renderFrame = test.frames.findLast((frame) => frame.kind === 'render')

    for (const [key, value] of expectedProps(rest)) {
      const inComponent = String(component?.props?.[key])
      const inFrame = String(renderFrame?.meta?.props?.[key])

      if (inComponent !== value || inFrame !== value) {
        problems.push(
          `${test.fullName}: ${key} is ${inComponent} in the component and ${inFrame} in the last render frame, expected ${value}`,
        )
      }
    }
  }

  if (checked === 0) {
    problems.push('no `names …` test, so component naming went unchecked')
  }

  return problems
}

/** The `key=value` words at the start of `text`, up to the first word without `=`. */
function expectedProps(text) {
  const props = []

  for (const word of text.trim().split(/\s+/)) {
    const separator = word.indexOf('=')

    if (separator === -1) {
      break
    }

    props.push([word.slice(0, separator), word.slice(separator + 1)])
  }

  return props
}

let failed = false

for (const path of paths) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const tests = manifest.modules.flatMap((module) => module.tests)
  const snapshots = snapshotProblemsIn(manifest, path)
  const store = storeProblemsIn(manifest, path)
  const states = pseudoStateProblemsIn(manifest, path)
  const problems = emptinessProblemsIn(manifest)
  problems.push(...closingFrameProblemsIn(manifest, path))
  problems.push(...orderProblemsIn(manifest))
  problems.push(...idProblemsIn(manifest))
  problems.push(...generatorProblemsIn(manifest), ...projectProblemsIn(manifest))
  problems.push(...sidebarProblemsIn(manifest, path))
  if (!structureOnly) {
    problems.push(...problemsIn(manifest))
    problems.push(...stableIdProblemsIn(manifest))
    problems.push(...timeProblemsIn(manifest))
    problems.push(...extractionProblemsIn(store))
    problems.push(...headProblemsIn(manifest), ...store.copiedCss.projectUrls)
    problems.push(...namingProblemsIn(manifest))
  }

  if (!structureOnly && requireFonts) {
    problems.push(...fontProblemsIn(manifest, store.copiedCss.reached))
  }

  problems.push(...snapshots.problems)
  problems.push(...store.problems)
  problems.push(...states.problems)

  if (problems.length > 0) {
    failed = true

    console.error(
      `check-manifest: ${path}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`,
    )

    continue
  }

  const frames = tests.flatMap((test) => test.frames).length
  const files = `${snapshots.files.length} snapshot files, ${store.chunks} style chunks`
  const groups = manifest.sidebar?.groups.length ?? 0
  const sidebar = groups > 0 ? `, ${groups} sidebar groups` : ''
  const counts = `${tests.length} tests, ${frames} frames (${states.frames} with states), ${files}${sidebar}`

  if (structureOnly) {
    console.log(`check-manifest: ok — ${path}: ${counts} (structure only)`)
    continue
  }

  const documented = Object.keys(manifest.components).length

  console.log(`check-manifest: ok — ${path}: ${counts}, ${documented} components documented`)
}

if (failed) {
  process.exit(1)
}
