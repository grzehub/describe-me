/**
 * Measures what an output directory weighs: snapshot files against distinct
 * DOMs, the bytes rrweb's `rootId` takes, the style chunks in `styles/` the
 * snapshots refer to, and how much CSS the snapshots carry, split into
 * styled-components sheets (`<style data-styled>`) and the rest. A sheet stored
 * in `styles/` is counted as if it were inlined, so the CSS figures compare
 * with output written before stylesheets moved out of the snapshots. Plain
 * Node without a build, so it also reads output of older versions.
 * Usage: `node scripts/measure-output.mjs <outDir|manifest.json> [...more]`
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const inputs = process.argv.slice(2)

if (inputs.length === 0) {
  console.error('usage: measure-output <outDir|manifest.json> [...more]')
  process.exit(2)
}

const ROOT_ID_MEMBER = /,?"rootId":\d+/g
const SPLIT_MARKER = '/* rr_split */'
const STYLE_PREFIX = 'describe-me-style:'

function manifestPathOf(input) {
  if (existsSync(input) && statSync(input).isDirectory()) {
    return join(input, 'manifest.json')
  }

  return input
}

function byteLength(text) {
  return Buffer.byteLength(text, 'utf8')
}

function childrenOf(node) {
  return Array.isArray(node.childNodes) ? node.childNodes : []
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

function hasDataStyled(node) {
  return typeof node?.attributes === 'object' && Object.hasOwn(node.attributes, 'data-styled')
}

/** Every stylesheet a snapshot inlines, and whether styled-components wrote it. */
function collectSheets(node, parent, sheets = []) {
  const cssText = node.attributes?._cssText
  if (typeof cssText === 'string') {
    sheets.push({ css: cssText, styled: hasDataStyled(node) })
  }

  if (node.isStyle === true && typeof node.textContent === 'string') {
    sheets.push({ css: node.textContent, styled: hasDataStyled(parent) })
  }

  for (const child of childrenOf(node)) {
    collectSheets(child, node, sheets)
  }

  return sheets
}

/** Top-level rules by brace depth. Braces inside strings and comments are not special-cased. */
function topLevelRules(css) {
  const rules = []
  let depth = 0
  let start = 0

  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '{') {
      depth++
    }

    if (char === '}') {
      depth = Math.max(0, depth - 1)
    }

    // A rule ends with the brace that closes its block, or with `;` for `@import` and friends.
    if ((char === '}' || char === ';') && depth === 0) {
      rules.push(css.slice(start, i + 1).trim())
      start = i + 1
    }
  }

  rules.push(css.slice(start).trim())

  return rules.filter((rule) => rule.length > 0)
}

/** Distinct texts on each side of the split: styled-components and everything else. */
function newSplitSets() {
  return { styled: new Set(), other: new Set() }
}

function sumBytes(texts) {
  let bytes = 0
  for (const text of texts) {
    bytes += byteLength(text)
  }

  return bytes
}

function newMeasurement(manifest, stylesDir) {
  const tests = manifest.modules.flatMap((module) => module.tests)
  const frames = tests.flatMap((test) => test.frames)

  return {
    tests: tests.length,
    frames: frames.length,
    files: [...new Set(frames.map((frame) => frame.snapshot))],
    missing: 0,
    doms: new Set(),
    bytes: 0,
    rootIdBytes: 0,
    stylesDir,
    /** Text of every style chunk the snapshots refer to, by hash; null when the file is missing. */
    chunks: new Map(),
    inlined: { styled: 0, other: 0 },
    sheets: newSplitSets(),
    rules: newSplitSets(),
  }
}

/** One style chunk's text, read once. A missing chunk warns, is counted and reads as empty. */
function chunkText(measurement, label, hash) {
  if (!measurement.chunks.has(hash)) {
    const abs = join(measurement.stylesDir, `${hash}.css`)
    const exists = existsSync(abs)
    if (!exists) {
      console.warn(`measure-output: ${label}: styles/${hash}.css referenced but missing`)
    }

    measurement.chunks.set(hash, exists ? readFileSync(abs, 'utf8') : null)
  }

  return measurement.chunks.get(hash) ?? ''
}

/** A sheet as the viewer replays it: a style reference is replaced by its joined chunks. */
function sheetText(measurement, label, css) {
  if (!css.startsWith(STYLE_PREFIX)) {
    return css
  }

  return css
    .slice(STYLE_PREFIX.length)
    .split('+')
    .map((hash) => chunkText(measurement, label, hash))
    .join('')
}

function addSheets(measurement, label, serialized) {
  for (const sheet of collectSheets(serialized)) {
    const side = sheet.styled ? 'styled' : 'other'
    const css = sheetText(measurement, label, sheet.css)
    measurement.inlined[side] += byteLength(css)
    measurement.sheets[side].add(css)

    for (const rule of topLevelRules(css.replaceAll(SPLIT_MARKER, ''))) {
      measurement.rules[side].add(rule)
    }
  }
}

function addSnapshot(measurement, label, json) {
  measurement.bytes += byteLength(json)

  for (const match of json.matchAll(ROOT_ID_MEMBER)) {
    measurement.rootIdBytes += byteLength(match[0])
  }

  let serialized
  try {
    serialized = JSON.parse(json)
  } catch {
    console.warn(`measure-output: ${label}: not valid JSON, skipped`)
    return
  }

  if (typeof serialized !== 'object' || serialized === null) {
    console.warn(`measure-output: ${label}: not an rrweb serialized document, skipped`)
    return
  }

  addSheets(measurement, label, serialized)
  stripNodeIds(serialized)
  measurement.doms.add(createHash('sha1').update(JSON.stringify(serialized)).digest('hex'))
}

function measure(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const measurement = newMeasurement(manifest, join(dirname(manifestPath), 'styles'))

  for (const file of measurement.files) {
    const abs = resolve(dirname(manifestPath), file)
    const label = `${manifestPath}: ${file}`
    if (!existsSync(abs)) {
      console.warn(`measure-output: ${label}: referenced but missing`)
      measurement.missing++
      continue
    }

    addSnapshot(measurement, label, readFileSync(abs, 'utf8'))
  }

  return measurement
}

function formatBytes(bytes) {
  if (bytes < 1000) {
    return `${bytes} B`
  }

  if (bytes < 1_000_000) {
    return `${(bytes / 1000).toFixed(1)} kB`
  }

  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

function percent(part, whole) {
  if (whole === 0) {
    return '0.0%'
  }

  return `${((part / whole) * 100).toFixed(1)}%`
}

/** `12.3 kB (4.5%)`: a part of the whole, in bytes and as a share. */
function share(part, whole) {
  return `${formatBytes(part)} (${percent(part, whole)})`
}

function inlinedLine(inlined) {
  const total = inlined.styled + inlined.other

  return [
    formatBytes(total),
    `data-styled ${share(inlined.styled, total)}`,
    `other ${formatBytes(inlined.other)}`,
  ].join(' · ')
}

function distinctLine(sets) {
  const styledBytes = sumBytes(sets.styled)
  const otherBytes = sumBytes(sets.other)
  const total = styledBytes + otherBytes

  return [
    `${sets.styled.size + sets.other.size} / ${formatBytes(total)}`,
    `data-styled ${sets.styled.size} / ${share(styledBytes, total)}`,
    `other ${sets.other.size} / ${formatBytes(otherBytes)}`,
  ].join(' · ')
}

function countsLine(measurement) {
  const missing = measurement.missing > 0 ? ` (${measurement.missing} missing)` : ''

  return [
    `tests ${measurement.tests}`,
    `frames ${measurement.frames}`,
    `snapshot files ${measurement.files.length}${missing}`,
    `distinct DOMs ${measurement.doms.size}`,
  ].join(' · ')
}

/** The style chunks the snapshots refer to, as files on disk. */
function stylesSummary(measurement) {
  const texts = [...measurement.chunks.values()]
  const stored = texts.filter((text) => text !== null)

  return { files: stored.length, missing: texts.length - stored.length, bytes: sumBytes(stored) }
}

function stylesLine(styles) {
  const missing = styles.missing > 0 ? ` (${styles.missing} missing)` : ''

  return `styles/ files ${styles.files}${missing} · ${formatBytes(styles.bytes)}`
}

function report(manifestPath, measurement) {
  const rootId = share(measurement.rootIdBytes, measurement.bytes)
  const styles = stylesSummary(measurement)

  return [
    manifestPath,
    `  ${countsLine(measurement)}`,
    `  snapshot bytes ${formatBytes(measurement.bytes)} · rootId ${rootId}`,
    `  ${stylesLine(styles)}`,
    `  total on disk ${formatBytes(measurement.bytes + styles.bytes)}`,
    `  CSS as if inlined: ${inlinedLine(measurement.inlined)}`,
    `  distinct sheets: ${distinctLine(measurement.sheets)}`,
    `  distinct rules: ${distinctLine(measurement.rules)}`,
  ].join('\n')
}

let failed = false

for (const input of inputs) {
  const manifestPath = manifestPathOf(input)
  if (!existsSync(manifestPath)) {
    console.error(`measure-output: ${manifestPath}: no manifest`)
    failed = true
    continue
  }

  console.log(report(manifestPath, measure(manifestPath)))
}

if (failed) {
  process.exit(1)
}
