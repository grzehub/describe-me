/**
 * Guards the generated manifests against silent regressions: every test must
 * have a `render` frame with a named component, every component must have its
 * props docs, and every asset must have been found. Run after `pnpm build`.
 *
 * What the reporter and the recorder guarantee is checked too: every module
 * has a test, every test has a frame besides the closing one, and no closing
 * frame shows an empty page. Every referenced snapshot file must also exist
 * and hold an rrweb serialized document whose ids start at 1 and carry no
 * `rootId`, and no two files may hold the same DOM (compared without rrweb's
 * node ids). `--structure-only` runs just these guarantees and snapshot
 * checks, which is what a real project can promise.
 *
 * Both modes also check the stores: every style chunk a snapshot refers to
 * exists, no chunk in `styles/` is orphaned, and every asset named in a
 * snapshot, a chunk or the preview head (`manifest.head`) is in `assets/`. So
 * is every sibling name inside a reachable CSS asset, transitively. The full
 * check also makes sure extraction is on: no snapshot inlines a sheet of 256+
 * characters, and some snapshot refers to a chunk. It also makes sure that
 * the head and the reachable CSS assets point only at stored assets or
 * outside the project. `--require-fonts` adds what this repository's examples
 * promise: the head links Google Fonts, and a stored `.woff2` is reachable.
 *
 * Usage: `node scripts/check-manifest.mjs [--structure-only] [--require-fonts] <path/to/manifest.json> [...more]`
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cssReferences } from '../packages/core/dist/css-references.js'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'

const STYLE_PREFIX = 'describe-me-style:'
const STYLE_REFERENCE = /describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)/g
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

  const { anonymous, undocumented, assetsMissing } = manifestDiagnostics(manifest)

  for (const test of anonymous) {
    problems.push(`${test.fullName}: anonymous component`)
  }

  for (const component of undocumented) {
    problems.push(`${component.name}: no props docs (${component.tests} tests)`)
  }

  for (const path of assetsMissing) {
    problems.push(`${path}: asset not found`)
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

/** Older output has no `styles/`, which counts as empty. */
function filesIn(dir) {
  return existsSync(dir) ? readdirSync(dir) : []
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

/** Each referenced chunk (`<hash>.css`) with the first file that refers to it. */
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

function headUrlsOf(manifest) {
  const head = manifest.head ?? ''

  return Array.from(head.matchAll(HEAD_URL), (match) => match[1] ?? match[2] ?? match[3])
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

let failed = false

for (const path of paths) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const tests = manifest.modules.flatMap((module) => module.tests)
  const snapshots = snapshotProblemsIn(manifest, path)
  const store = storeProblemsIn(manifest, path)
  const problems = emptinessProblemsIn(manifest)
  problems.push(...closingFrameProblemsIn(manifest, path))
  if (!structureOnly) {
    problems.push(...problemsIn(manifest))
    problems.push(...extractionProblemsIn(store))
    problems.push(...headProblemsIn(manifest), ...store.copiedCss.projectUrls)
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
