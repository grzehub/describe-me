/**
 * Guards the generated manifests against silent regressions: every test must
 * have a `render` frame with a named component, every component must have its
 * props docs, and every asset must have been found. Run after `pnpm build`.
 *
 * What the reporter guarantees is checked too: every module has a test, and
 * every test has a frame besides the closing one. Every referenced snapshot
 * file must also exist and hold an rrweb serialized document whose ids start
 * at 1 and carry no `rootId`, and no two files may hold the same DOM (compared
 * without rrweb's node ids). `--structure-only` runs just these guarantees and
 * snapshot checks, which is what a real project can promise.
 *
 * Both modes also check the stores: every style chunk a snapshot refers to
 * exists, no chunk in `styles/` is orphaned, and every asset named in a
 * snapshot or chunk is in `assets/`. The full check also makes sure extraction
 * is on: no snapshot inlines a sheet of 256+ characters, and some snapshot
 * refers to a chunk.
 *
 * Usage: `node scripts/check-manifest.mjs [--structure-only] <path/to/manifest.json> [...more]`
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'

const STYLE_PREFIX = 'describe-me-style:'
const STYLE_REFERENCE = /describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)/g
// The same pattern as ASSET_REFERENCE in packages/vitest/src/asset-store.ts.
const ASSET_REFERENCE = /describe-me-asset:([0-9a-f]{16}(?:\.[a-z0-9]+)?)/g
// A copy of MIN_EXTRACTED_LENGTH in packages/vitest/src/style-store.ts.
const MIN_EXTRACTED_LENGTH = 256

const STRUCTURE_ONLY = '--structure-only'
const structureOnly = process.argv.includes(STRUCTURE_ONLY)
const paths = process.argv.slice(2).filter((arg) => arg !== STRUCTURE_ONLY)

if (paths.length === 0) {
  console.error('usage: check-manifest [--structure-only] <path/to/manifest.json> [...more]')
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
  problems.push(...assetProblemsIn(outDir, [...snapshots, ...textsOf(outDir, chunkFiles)]))

  return { snapshots, chunks: referenced.size, problems }
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
  if (!structureOnly) {
    problems.push(...problemsIn(manifest))
    problems.push(...extractionProblemsIn(store))
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
