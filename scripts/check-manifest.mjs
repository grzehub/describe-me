/**
 * Guards the generated manifests against silent regressions: every test must
 * have a `render` frame with a named component, every component must have its
 * props docs, and every asset must have been found. Run after `pnpm build`.
 *
 * Every referenced snapshot file must also exist and hold an rrweb serialized
 * document whose ids start at 1 and carry no `rootId`, and no two files may
 * hold the same DOM (compared without rrweb's node ids). `--structure-only`
 * runs just these snapshot checks, which is what a real project can promise.
 *
 * Usage: `node scripts/check-manifest.mjs [--structure-only] <path/to/manifest.json> [...more]`
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'

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

let failed = false

for (const path of paths) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const tests = manifest.modules.flatMap((module) => module.tests)
  const snapshots = snapshotProblemsIn(manifest, path)
  const problems = structureOnly ? [] : problemsIn(manifest)
  problems.push(...snapshots.problems)

  if (problems.length > 0) {
    failed = true

    console.error(
      `check-manifest: ${path}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`,
    )

    continue
  }

  const frames = tests.flatMap((test) => test.frames).length
  const counts = `${tests.length} tests, ${frames} frames, ${snapshots.files.length} snapshot files`

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
