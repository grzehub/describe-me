/**
 * Checks how @describe-me/vitest chunks, extracts and garbage-collects
 * stylesheets, on its built output. Run after `pnpm build`.
 *
 * Usage: `node scripts/check-style-store.mjs`
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AssetStore } from '../packages/vitest/dist/asset-store.js'
import { splitStylesheet } from '../packages/vitest/dist/split-stylesheet.js'
import { StyleStore } from '../packages/vitest/dist/style-store.js'

// Copied from packages/vitest/src/split-stylesheet.ts and style-store.ts. Keep in sync.
const MIN_CHUNK = 1024
const MAX_CHUNK = 16384
const MIN_EXTRACTED_LENGTH = 256

const SPLIT_MARKER = '/* rr_split */'
const STYLE_PREFIX = 'describe-me-style:'
const STYLE_MEMBER = /"_cssText":"describe-me-style:([0-9a-f+]+)"/g

/** About 60 KB of CSS. */
const FIXTURE_ITEMS = 1200

/** A little over 1 MB of CSS. */
const LARGE_SHEET_ITEMS = 20_000

/**
 * Each item, varied by its index, holds exactly one top-level rule with its
 * leading whitespace or comment, so a chunk may only end where an item ends.
 */
const ITEM_KINDS = [
  (i) => `\n.rule-${i} { color: #${(i * 4099).toString(16).padStart(6, '0').slice(-6)}; }`,
  (i) => `${SPLIT_MARKER}.split-${i} { margin: ${i}px auto; }`,
  (i) => `\n.brace-${i}::before { content: "};{"; }`,
  (i) => `\n.semicolon-${i}::after { content: ';'; }`,
  (i) => `\n.quote-${i}::before { content: "\\"}"; }`,
  (i) => `\n/* before rule ${i}: { } ; */\n.after-comment-${i} { color: blue; }`,
  (i) => `\n.inner-comment-${i} { color: red; /* { } ; */ background: none; }`,
  (i) => `\n@media (min-width: ${600 + i}px) { .a-${i} {} .b-${i} {} }`,
  (i) => `\n@import url(https://fonts.example/css2?family=A${i}:wght@400;600&display=swap);`,
  (i) => `\n.data-${i} { background: url(data:image/png;base64,iVBOR;w0KGgo=); }`,
  (i) => `\n.content-\\[\\'\\}\\'\\]-${i} { color: red; }`,
  (i) => `\n.svg-${i} { background: url(data:image/svg+xml;utf8,<svg>};</svg>); }`,
  (i) => `\n.calc-${i} { width: calc((100% - ${i % 40}px) / 2); }`,
]

const directories = []
let failures = 0

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-'))
  directories.push(dir)

  return dir
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** `run` returns a boolean or `{ passed, detail }`. A check that throws fails. */
function check(name, run) {
  let outcome
  try {
    outcome = run()
  } catch (error) {
    outcome = { passed: false, detail: `threw: ${errorMessage(error)}` }
  }

  const { passed, detail } = typeof outcome === 'boolean' ? { passed: outcome } : outcome
  const suffix = detail ? ` (${detail})` : ''
  if (!passed) {
    failures++
  }

  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${name}${suffix}`)
}

function kilobytes(length) {
  return `${(length / 1000).toFixed(1)} kB`
}

function countOf(text, needle) {
  return text.split(needle).length - 1
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, i) => value === right[i])
}

function generateItems(count) {
  return Array.from({ length: count }, (_, i) => ITEM_KINDS[i % ITEM_KINDS.length](i))
}

function sheetOf(items) {
  const ends = []
  let length = 0
  for (const item of items) {
    length += item.length
    ends.push(length)
  }

  return { css: items.join(''), ends }
}

function chunkEnds(chunks) {
  return sheetOf(chunks).ends
}

function strayCuts(chunks, itemEnds) {
  const allowed = new Set(itemEnds)

  return chunkEnds(chunks)
    .slice(0, -1)
    .filter((end) => !allowed.has(end))
}

function checkCuts(name, chunks, itemEnds) {
  check(name, () => {
    const stray = strayCuts(chunks, itemEnds)
    const detail =
      stray.length === 0 ? `${chunks.length - 1} cuts` : `stray cuts at ${stray.slice(0, 5)}`

    return { passed: stray.length === 0, detail }
  })
}

function longest(texts) {
  return texts.reduce((max, text) => Math.max(max, text.length), 0)
}

function shortest(texts) {
  return texts.reduce((min, text) => Math.min(min, text.length), Infinity)
}

function checkSplitTrivialInputs() {
  check('a one-rule sheet is one chunk equal to the input', () => {
    const css = '.a { color: red; }'

    return sameList(splitStylesheet(css), [css])
  })

  check("'' gives no chunk, or one empty chunk", () => {
    const chunks = splitStylesheet('')

    return chunks.join('') === '' && (chunks.length === 0 || sameList(chunks, ['']))
  })

  check('malformed CSS round-trips without throwing', () => {
    const inputs = [
      '.a { color: red',
      '}}} ))) {{',
      '.a { content: "never closed',
      '/* never closed',
      '.a\\',
      ')))((({{{ ;;; }}}',
      '}'.repeat(5000),
      `${'.a { color: red; } '.repeat(500)}.b { color: `,
      `${'( '.repeat(300)}${'.c { color: blue; } '.repeat(300)}`,
    ]

    const broken = inputs.filter((css) => splitStylesheet(css).join('') !== css)

    return { passed: broken.length === 0, detail: `${inputs.length} inputs` }
  })
}

function checkSplitBoundaries() {
  const items = generateItems(FIXTURE_ITEMS)
  const { css, ends } = sheetOf(items)
  const chunks = splitStylesheet(css)

  check('boundary fixture round-trips in more than 3 chunks', () => {
    return {
      passed: css.length >= 40_000 && chunks.join('') === css && chunks.length > 3,
      detail: `${kilobytes(css.length)}, ${chunks.length} chunks`,
    }
  })

  checkCuts('every cut lands on an item end', chunks, ends)

  check('no rr_split marker is cut', () => {
    const inChunks = chunks.reduce((sum, chunk) => sum + countOf(chunk, SPLIT_MARKER), 0)
    const inSheet = countOf(css, SPLIT_MARKER)

    return { passed: inChunks === inSheet, detail: `${inChunks} of ${inSheet}` }
  })
}

function checkSplitLocality() {
  check('inserting a rule keeps the chunks before it and most after it', () => {
    const items = generateItems(FIXTURE_ITEMS)
    const sheet = sheetOf(items)
    const middle = Math.floor(items.length / 2)
    const insertedAt = sheet.ends[middle - 1]
    const inserted = '\n.inserted-rule { color: rebeccapurple; padding: 3px 6px; }'
    const original = splitStylesheet(sheet.css)
    const changed = splitStylesheet(
      [...items.slice(0, middle), inserted, ...items.slice(middle)].join(''),
    )

    const ends = chunkEnds(original)
    const before = original.filter((_, i) => ends[i] <= insertedAt)
    const after = original.filter((chunk, i) => ends[i] - chunk.length >= insertedAt)
    const kept = new Set(changed)
    const keptAfter = after.filter((chunk) => kept.has(chunk)).length

    return {
      passed:
        before.length > 0 &&
        before.every((chunk, i) => changed[i] === chunk) &&
        after.length > 0 &&
        keptAfter * 2 >= after.length,
      detail: `${before.length} chunks before unchanged, ${keptAfter} of ${after.length} after`,
    }
  })
}

function checkSplitSizes() {
  const items = generateItems(LARGE_SHEET_ITEMS)
  const { css, ends } = sheetOf(items)
  const started = performance.now()
  const chunks = splitStylesheet(css)
  const elapsed = performance.now() - started

  check('a 1 MB sheet round-trips with chunks of the promised sizes', () => {
    const average = css.length / chunks.length

    return {
      passed:
        css.length >= 1_000_000 &&
        chunks.join('') === css &&
        chunks.slice(0, -1).every((chunk) => chunk.length >= MIN_CHUNK) &&
        chunks.every((chunk) => chunk.length <= MAX_CHUNK + longest(items)) &&
        average >= 2000 &&
        average <= 8000,
      detail: [
        kilobytes(css.length),
        `${chunks.length} chunks`,
        `average ${Math.round(average)}`,
        `shortest non-final ${shortest(chunks.slice(0, -1))}`,
        `largest ${longest(chunks)}`,
        `${elapsed.toFixed(0)} ms`,
      ].join(', '),
    }
  })

  checkCuts('every cut in the 1 MB sheet lands on an item end', chunks, ends)

  check('a 20 KB rule between small rules stays whole in one chunk', () => {
    const declarations = Array.from({ length: 1500 }, (_, i) => `--v${i}: ${i}px;`)
    const huge = `\n.huge { ${declarations.join(' ')} }`
    const small = generateItems(200)
    const css = [...small.slice(0, 100), huge, ...small.slice(100)].join('')
    const chunks = splitStylesheet(css)

    return {
      passed:
        huge.length >= 20_000 &&
        chunks.join('') === css &&
        chunks.some((chunk) => chunk.includes(huge)),
      detail: `${kilobytes(huge.length)} rule, ${chunks.length} chunks`,
    }
  })
}

function snapshotJson(sheets, text = 'hello') {
  const styles = sheets.map((css, i) => ({
    type: 2,
    tagName: 'style',
    attributes: { _cssText: css },
    childNodes: [],
    id: 4 + i,
  }))

  return JSON.stringify({
    type: 0,
    childNodes: [
      {
        type: 2,
        tagName: 'html',
        attributes: {},
        childNodes: [
          { type: 2, tagName: 'head', attributes: {}, childNodes: styles, id: 3 },
          {
            type: 2,
            tagName: 'body',
            attributes: {},
            childNodes: [{ type: 3, textContent: text, id: 100 }],
            id: 99,
          },
        ],
        id: 2,
      },
    ],
    id: 1,
  })
}

/**
 * A rule of exactly `length` characters. Its quote and backslash make the JSON
 * longer, which the threshold must not count.
 */
function ruleOfLength(length) {
  const head = '.t::before { content: "\\"'
  const tail = '"; }'

  return `${head}${'x'.repeat(length - head.length - tail.length)}${tail}`
}

/** Rules whose quotes, backslashes, non-ASCII text and asset URL test JSON escaping. */
function richSheet(length, prefix = 'rich', asset = '0123456789abcdef.png') {
  const kinds = [
    (i) => `.${prefix}-quote-${i}::before { content: "\\201C"; }`,
    (i) => `.${prefix}-arrow-${i}::after { content: "→"; }`,
    (i) => `.${prefix}-stamp-${i} { background: url("describe-me-asset:${asset}") repeat; }`,
    (i) => `.${prefix}-plain-${i} { color: rgb(${i % 256}, 0, 0); }`,
  ]

  let css = ''
  for (let i = 0; css.length < length; i++) {
    css += kinds[i % kinds.length](i)
  }

  return css
}

function referencesIn(json) {
  return Array.from(json.matchAll(STYLE_MEMBER), (match) => match[1].split('+'))
}

function restored(json, outDir) {
  return json.replace(STYLE_MEMBER, (_member, hashes) => {
    const css = hashes
      .split('+')
      .map((hash) => readFileSync(join(outDir, 'styles', `${hash}.css`), 'utf8'))
      .join('')

    return `"_cssText":${JSON.stringify(css)}`
  })
}

function checkExtractThreshold() {
  check('a 100-character sheet stays inline', () => {
    const outDir = tempDir()
    const json = snapshotJson([ruleOfLength(100)])
    const untouched = new StyleStore(outDir).extract(json) === json

    return untouched && readdirSync(join(outDir, 'styles')).length === 0
  })

  check('255 characters stay inline, 256 move to styles/', () => {
    const store = new StyleStore(tempDir())
    const below = snapshotJson([ruleOfLength(MIN_EXTRACTED_LENGTH - 1)])
    const at = snapshotJson([ruleOfLength(MIN_EXTRACTED_LENGTH)])

    return store.extract(below) === below && store.extract(at).includes(STYLE_PREFIX)
  })
}

function checkExtractRoundTrip() {
  check('a 5 KB sheet becomes a reference that restores the JSON byte for byte', () => {
    const outDir = tempDir()
    const json = snapshotJson([richSheet(5000), ruleOfLength(100)])
    const extracted = new StyleStore(outDir).extract(json)
    const references = referencesIn(extracted)

    return {
      passed: references.length === 1 && restored(extracted, outDir) === json,
      detail: `${kilobytes(json.length)} → ${kilobytes(extracted.length)}`,
    }
  })

  check('the text "_cssText":" inside a text node is left alone', () => {
    const outDir = tempDir()
    const json = snapshotJson([], `"_cssText":"${'y'.repeat(300)}`)
    const untouched = new StyleStore(outDir).extract(json) === json

    return untouched && readdirSync(join(outDir, 'styles')).length === 0
  })

  check('two snapshots sharing a sheet leave one set of chunk files', () => {
    const outDir = tempDir()
    const store = new StyleStore(outDir)
    const sheet = richSheet(20_000)
    const first = referencesIn(store.extract(snapshotJson([sheet], 'first')))
    const second = referencesIn(store.extract(snapshotJson([sheet], 'second')))
    const files = readdirSync(join(outDir, 'styles'))
    const chunks = new Set(splitStylesheet(sheet)).size

    return {
      passed: sameList(first.flat(), second.flat()) && files.length === chunks && chunks > 1,
      detail: `${files.length} files for ${chunks} chunks`,
    }
  })
}

function checkExtractIdempotence() {
  check('extract is idempotent, also for a reference of 256+ characters', () => {
    const store = new StyleStore(tempDir())
    const once = store.extract(snapshotJson([richSheet(5000), richSheet(120_000)]))
    const references = referencesIn(once).map((hashes) => `${STYLE_PREFIX}${hashes.join('+')}`)

    return {
      passed: store.extract(once) === once && longest(references) >= MIN_EXTRACTED_LENGTH,
      detail: `longest reference ${longest(references)} characters`,
    }
  })

  check('a snapshot with a 1 MB sheet is extracted', () => {
    const outDir = tempDir()
    const { css } = sheetOf(generateItems(LARGE_SHEET_ITEMS))
    const json = snapshotJson([css])
    const started = performance.now()
    const extracted = new StyleStore(outDir).extract(json)
    const elapsed = performance.now() - started

    return {
      passed: restored(extracted, outDir) === json,
      detail: `${kilobytes(css.length)} in ${elapsed.toFixed(0)} ms`,
    }
  })
}

function writeSnapshot(outDir, name, json) {
  mkdirSync(join(outDir, 'snapshots'), { recursive: true })
  writeFileSync(join(outDir, 'snapshots', name), json)

  return `snapshots/${name}`
}

function checkGarbageCollection() {
  check('style GC drops unreferenced chunks and stray files, returns the kept ones', () => {
    const outDir = tempDir()
    const store = new StyleStore(outDir)
    const kept = writeSnapshot(outDir, 'kept.json', store.extract(snapshotJson([richSheet(9000)])))
    writeSnapshot(outDir, 'dropped.json', store.extract(snapshotJson([richSheet(9000, 'gone')])))
    writeFileSync(join(outDir, 'styles', 'notes.txt'), 'stray')
    writeFileSync(join(outDir, 'styles', '0123456789abcdef.css'), '.orphan {}')

    const keptHashes = referencesIn(readFileSync(join(outDir, kept), 'utf8')).flat()
    const expected = [...new Set(keptHashes)].map((hash) => `styles/${hash}.css`).sort()
    const returned = store.collectGarbage([kept, kept, 'snapshots/missing.json'])
    const left = readdirSync(join(outDir, 'styles'))
      .map((file) => `styles/${file}`)
      .sort()

    return {
      passed: expected.length > 1 && sameList(returned, expected) && sameList(left, expected),
      detail: `${returned.length} kept, ${left.length} left on disk`,
    }
  })

  check('asset GC keeps an asset only a style chunk refers to', () => {
    const outDir = tempDir()
    const styles = new StyleStore(outDir)
    const assets = new AssetStore(outDir, tempDir())
    const json = styles.extract(snapshotJson([richSheet(2000, 'rich', 'aaaaaaaaaaaaaaaa.png')]))
    const snapshot = writeSnapshot(outDir, 'one.json', json)
    writeFileSync(join(outDir, 'assets', 'aaaaaaaaaaaaaaaa.png'), 'referenced from a chunk')
    writeFileSync(join(outDir, 'assets', 'bbbbbbbbbbbbbbbb.png'), 'referenced from nothing')

    const styleFiles = styles.collectGarbage([snapshot])
    assets.collectGarbage([snapshot, ...styleFiles])
    const left = readdirSync(join(outDir, 'assets'))

    return {
      passed: !json.includes('describe-me-asset:') && sameList(left, ['aaaaaaaaaaaaaaaa.png']),
      detail: `left: ${left.join(', ')}`,
    }
  })
}

try {
  checkSplitTrivialInputs()
  checkSplitBoundaries()
  checkSplitLocality()
  checkSplitSizes()
  checkExtractThreshold()
  checkExtractRoundTrip()
  checkExtractIdempotence()
  checkGarbageCollection()
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-style-store: ${failures} check(s) failed`)
  process.exit(1)
}
