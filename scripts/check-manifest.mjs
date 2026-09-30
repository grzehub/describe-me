/**
 * Guards the generated manifests against silent regressions: every test must
 * have a `render` frame with a named component, every component must have its
 * props docs, every asset must have been found, every font family that frames
 * use must be loaded, no frame may load a stylesheet from a remote host, and
 * the plugin must have found no problem in the setup (`setupWarnings`).
 * The manifest must also carry both font audit lists. Run after `pnpm build`.
 *
 * What the reporter and the recorder guarantee is checked too: every module
 * has a test, every test has a frame besides the closing one, and no closing
 * frame shows an empty page. Frames keep call order: their ids count up from
 * `f0`, and a closing frame is always a test's last. Every referenced
 * snapshot file must also exist and hold an rrweb serialized document whose
 * ids start at 1 and carry no `rootId`, and no two files may hold the same
 * DOM (compared without rrweb's node ids). `--structure-only` runs just these
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
 * adds what this repository's examples promise: the head links Google Fonts,
 * and a stored `.woff2` is reachable.
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
 * Usage: `node scripts/check-manifest.mjs [--structure-only] [--require-fonts] <path/to/manifest.json> [...more]`
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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

  const { setupWarnings, anonymous, undocumented, assetsMissing, fontsMissing, remoteStylesheets } =
    manifestDiagnostics(manifest)

  for (const warning of setupWarnings) {
    problems.push(`setup: ${warning}`)
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

/** `--require-fonts`: both examples load Inter from Google Fonts and Lora from a local file. */
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
  const problems = emptinessProblemsIn(manifest)
  problems.push(...closingFrameProblemsIn(manifest, path))
  problems.push(...orderProblemsIn(manifest))
  problems.push(...idProblemsIn(manifest))
  problems.push(...generatorProblemsIn(manifest))
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

  if (problems.length > 0) {
    failed = true

    console.error(
      `check-manifest: ${path}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`,
    )

    continue
  }

  const frames = tests.flatMap((test) => test.frames).length
  const files = `${snapshots.files.length} snapshot files, ${store.chunks} style chunks`
  const counts = `${tests.length} tests, ${frames} frames, ${files}`

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
