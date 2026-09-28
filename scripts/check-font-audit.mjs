/**
 * Checks which font families @describe-me/vitest counts as missing and which
 * remote stylesheet hosts it lists, on its built output. Every case builds a
 * small output directory with snapshots, style chunks, assets and a manifest.
 * Run after `pnpm build`.
 *
 * Usage: `node scripts/check-font-audit.mjs`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { manifestDiagnostics } from '../packages/core/dist/manifest-diagnostics.js'
import { FontAudit } from '../packages/vitest/dist/font-audit.js'
import { fontFamilyKey } from '../packages/vitest/dist/font-family-key.js'
import { fontFamilyList } from '../packages/vitest/dist/font-family-list.js'
import { fontShorthandFamilies } from '../packages/vitest/dist/font-shorthand-families.js'
import { fontStylesheetFamilies } from '../packages/vitest/dist/font-stylesheet-families.js'

const GOOGLE_INTER = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&amp;display=swap'

const TYPEKIT = 'https://use.typekit.net/abc1def.css'

/** rrweb node types, from `NodeType` in rrweb-snapshot. */
const DOCUMENT_NODE = 0
const ELEMENT_NODE = 2
const TEXT_NODE = 3

const directories = []
let failures = 0

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function same(actual, expected) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected)

  return passed ? true : { passed, detail: `got ${JSON.stringify(actual)}` }
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

function element(tagName, attributes = {}, childNodes = []) {
  return { type: ELEMENT_NODE, tagName, attributes, childNodes }
}

/** A `<style>` as rrweb writes it when it could read the sheet: `_cssText` and an empty text child. */
function style(cssText) {
  return element('style', { _cssText: cssText }, [{ type: TEXT_NODE, textContent: '' }])
}

function link(rel, href) {
  return element('link', { rel, href })
}

function styled(styleAttribute) {
  return element('div', { style: styleAttribute })
}

function documentOf(...nodes) {
  return {
    type: DOCUMENT_NODE,
    id: 1,
    childNodes: [element('html', {}, [element('head', {}, nodes), element('body')])],
  }
}

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-fonts-'))
  directories.push(dir)

  return dir
}

/**
 * An output directory with the given files, and a manifest whose tests are
 * lists of snapshot names, one frame each. Snapshots are documents or lists of
 * head nodes.
 */
function fixture({ snapshots = {}, chunks = {}, assets = {}, tests, head }) {
  const outDir = tempDir()
  mkdirSync(join(outDir, 'snapshots'))
  mkdirSync(join(outDir, 'styles'))
  mkdirSync(join(outDir, 'assets'))

  for (const [name, snapshot] of Object.entries(snapshots)) {
    const serialized = Array.isArray(snapshot) ? documentOf(...snapshot) : snapshot
    writeFileSync(join(outDir, 'snapshots', `${name}.json`), JSON.stringify(serialized))
  }

  for (const [hash, css] of Object.entries(chunks)) {
    writeFileSync(join(outDir, 'styles', `${hash}.css`), css)
  }

  for (const [name, css] of Object.entries(assets)) {
    writeFileSync(join(outDir, 'assets', name), css)
  }

  const testLists = tests ?? [Object.keys(snapshots)]
  const manifest = {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    root: outDir,
    components: {},
    modules: [
      {
        id: 'src/Example.test.tsx',
        tests: testLists.map((frames, index) => ({
          id: `test-${index + 1}`,
          name: `test ${index + 1}`,
          path: [],
          fullName: `test ${index + 1}`,
          state: 'passed',
          frames: frames.map((snapshot, frameIndex) => ({
            id: `frame-${frameIndex}`,
            kind: 'render',
            label: 'render',
            at: 0,
            snapshot: `snapshots/${snapshot}.json`,
          })),
        })),
      },
    ],
  }

  if (head !== undefined) {
    manifest.head = head
  }

  return { outDir, manifest }
}

function audit(options) {
  const { outDir, manifest } = fixture(options)

  return new FontAudit(outDir).audit(manifest)
}

/** The missing families of one snapshot made of these head nodes. */
function missingIn(nodes, head) {
  return audit({ snapshots: { one: nodes }, head }).fontsMissing.map((font) => font.family)
}

function missingInCss(css, head) {
  return missingIn([style(css)], head)
}

function hostsIn(options) {
  return audit(options).remoteStylesheets
}

const hexName = (index) => index.toString(16).padStart(16, '0')

// Helpers

check('fontFamilyKey: Noto+Sans+Arabic, quoted and kebab-case spellings share a key', () =>
  same(['Noto+Sans+Arabic', "'Noto Sans Arabic'", 'noto-sans-arabic'].map(fontFamilyKey), [
    'noto sans arabic',
    'noto sans arabic',
    'noto sans arabic',
  ]),
)

check('fontFamilyList: a quoted name keeps its comma', () =>
  same(fontFamilyList('"Foo, Bar", serif'), ['Foo, Bar', 'serif']),
)

check('fontShorthandFamilies: font: 0/0 a has no size', () =>
  same(fontShorthandFamilies('0/0 a'), null),
)

check('fontShorthandFamilies: font: inherit is a keyword', () =>
  same(fontShorthandFamilies('inherit'), null),
)

check('fontShorthandFamilies: Chrome spacing 14px / 1.5', () =>
  same(fontShorthandFamilies("600 14px / 1.5 'Inter', sans-serif"), ['Inter', 'sans-serif']),
)

check('fontStylesheetFamilies: an unknown host gives null', () =>
  same(fontStylesheetFamilies(TYPEKIT), null),
)

// First families

check('-apple-system as the first family gives nothing', () =>
  same(missingInCss('body { font-family: -apple-system, BlinkMacSystemFont, sans-serif }'), []),
)

check('font: inherit gives nothing', () => same(missingInCss('button { font: inherit }'), []))

check("Chrome's expanded font-family: inherit gives nothing", () =>
  same(
    missingInCss('button { font-family: inherit; font-optical-sizing: inherit; font-size: 100% }'),
    [],
  ),
)

check("font: 600 14px/1.5 'Inter', sans-serif gives Inter", () =>
  same(missingInCss("p { font: 600 14px/1.5 'Inter', sans-serif }"), ['Inter']),
)

check('font: 600 14px / 1.5 Inter gives Inter', () =>
  same(missingInCss('p { font: 600 14px / 1.5 Inter }'), ['Inter']),
)

check('font: 0/0 a gives nothing', () => same(missingInCss('.hide-text { font: 0/0 a }'), []))

check('font-size, font-weight and font-variant-numeric never count', () =>
  same(
    missingInCss('p { font-size: Foo; font-weight: Bar; font-variant-numeric: Baz tabular-nums }'),
    [],
  ),
)

check('-webkit-font-smoothing never counts', () =>
  same(missingInCss('body { -webkit-font-smoothing: Foo }'), []),
)

// var()

check('var(): a definition resolves', () =>
  same(
    missingInCss(':root { --font-body: Brand Sans, serif } p { font-family: var(--font-body) }'),
    ['Brand Sans'],
  ),
)

check('var(): var(--missing, Fallback Sans) uses the fallback', () =>
  same(missingInCss('p { font-family: var(--missing, Fallback Sans), serif }'), ['Fallback Sans']),
)

check('var(): a font shorthand ending in var() resolves', () =>
  same(missingInCss(':root { --brand: Brand Sans } p { font: 600 14px/1.5 var(--brand) }'), [
    'Brand Sans',
  ]),
)

check('var(): a font value that is one var() resolves through a shorthand definition', () =>
  same(missingInCss(':root { --type: 600 14px/1.5 Brand Sans } p { font: var(--type) }'), [
    'Brand Sans',
  ]),
)

check('var(): a 3-level chain resolves', () =>
  same(
    missingInCss(
      ':root { --one: var(--two); --two: var(--three); --three: Deep Sans } p { font-family: var(--one) }',
    ),
    ['Deep Sans'],
  ),
)

check('var(): a 4-level chain does not resolve', () =>
  same(
    missingInCss(
      ':root { --one: var(--two); --two: var(--three); --three: var(--four); --four: Deeper Sans } p { font-family: var(--one) }',
    ),
    [],
  ),
)

check('var(): both of two definitions count', () =>
  same(
    missingInCss(
      ':root { --font: Light Sans } .dark { --font: Dark Sans } p { font-family: var(--font) }',
    ),
    ['Dark Sans', 'Light Sans'],
  ),
)

check('var(): an unused --brand-display: Foo is never reported', () =>
  same(missingInCss(':root { --brand-display: Foo } p { color: red }'), []),
)

// Font providers

check('an unquoted jsdom-style Google @import covers Inter', () =>
  same(
    missingInCss(
      '@import url(https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap); body { font-family: Inter, sans-serif }',
    ),
    [],
  ),
)

check('Google /css?family=Open+Sans:400,700|Roboto+Mono gives both families', () =>
  same(
    fontStylesheetFamilies('https://fonts.googleapis.com/css?family=Open+Sans:400,700|Roboto+Mono'),
    ['Open Sans', 'Roboto Mono'],
  ),
)

check('Google /css with both families covers both', () =>
  same(
    missingIn([
      link('stylesheet', 'https://fonts.googleapis.com/css?family=Open+Sans:400,700|Roboto+Mono'),
      style("p { font-family: 'Open Sans' } code { font-family: 'Roboto Mono' }"),
    ]),
    [],
  ),
)

check('Bunny open-sans covers Open Sans', () =>
  same(
    missingIn([
      link('stylesheet', 'https://fonts.bunny.net/css?family=open-sans:400,700'),
      style("p { font-family: 'Open Sans', sans-serif }"),
    ]),
    [],
  ),
)

check('jsDelivr @fontsource/inter covers Inter', () =>
  same(
    missingIn([
      link('stylesheet', 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/index.css'),
      style('p { font-family: Inter }'),
    ]),
    [],
  ),
)

check('jsDelivr @fontsource-variable/inter covers Inter Variable', () =>
  same(
    missingIn([
      link('stylesheet', 'https://cdn.jsdelivr.net/npm/@fontsource-variable/inter/index.css'),
      style("p { font-family: 'Inter Variable' }"),
    ]),
    [],
  ),
)

check('jsDelivr @fontsource-variable/inter does not cover plain Inter', () =>
  same(
    missingIn([
      link('stylesheet', 'https://cdn.jsdelivr.net/npm/@fontsource-variable/inter/index.css'),
      style('p { font-family: Inter }'),
    ]),
    ['Inter'],
  ),
)

check('a Typekit link in a snapshot reports nothing for it and lists use.typekit.net', () => {
  const result = audit({
    snapshots: {
      typekit: [link('stylesheet', TYPEKIT), style('p { font-family: Adobe Sans }')],
      plain: [style('p { font-family: Plain Sans }')],
    },
    tests: [['typekit'], ['plain']],
  })

  return same(
    [result.fontsMissing.map((font) => font.family), result.remoteStylesheets],
    [['Plain Sans'], [{ host: 'use.typekit.net', frames: 1 }]],
  )
})

check('a Typekit link in the head reports nothing at all', () =>
  same(
    missingInCss('p { font-family: Adobe Sans }', `<link rel="stylesheet" href="${TYPEKIT}">`),
    [],
  ),
)

// Parsing

check('!important is stripped', () =>
  same(missingInCss('p { font-family: Brand Sans !important }'), ['Brand Sans']),
)

check('a newline-separated list gives its first family', () =>
  same(missingInCss('body { font-family: Inter,\n    ui-sans-serif,\n    system-ui }'), ['Inter']),
)

check('a quoted name with a comma stays one family', () =>
  same(missingInCss('p { font-family: "Odd, Name", serif }'), ['Odd, Name']),
)

check('an inline style attribute counts', () =>
  same(missingIn([styled('color: red; font-family: Inline Sans')]), ['Inline Sans']),
)

check("an escaped selector .font-\\[\\'Open_Sans\\'\\] gives Open Sans", () =>
  same(missingInCss(".font-\\[\\'Open_Sans\\'\\]{font-family:'Open Sans'}"), ['Open Sans']),
)

check('a family used only in a style chunk is found', () =>
  same(
    audit({
      snapshots: { one: [style(`describe-me-style:${hexName(1)}+${hexName(2)}`)] },
      chunks: { [hexName(1)]: '.a { color: red }', [hexName(2)]: '.b { font-family: Chunk Sans }' },
    }).fontsMissing.map((font) => font.family),
    ['Chunk Sans'],
  ),
)

check('a <style> text child counts when rrweb could not read the sheet', () =>
  same(
    missingIn([
      element('style', {}, [{ type: TEXT_NODE, textContent: 'p { font-family: Raw Sans }' }]),
    ]),
    ['Raw Sans'],
  ),
)

// @font-face

check('@font-face in the same snapshot covers the family', () =>
  same(
    missingInCss(
      "@font-face { font-family: 'Lora'; src: url(lora.woff2) } p { font-family: Lora, serif }",
    ),
    [],
  ),
)

check('font-family inside @font-face is not usage', () =>
  same(missingInCss("@font-face { font-family: 'Unused Face'; src: url(face.woff2) }"), []),
)

// Head

check(
  'a head describe-me-asset: CSS link whose sibling @import declares the family covers it',
  () =>
    same(
      audit({
        snapshots: { one: [style('p { font-family: Lora }')] },
        assets: {
          '0000000000000001.css': "@import '0000000000000002.css';",
          '0000000000000002.css':
            "@font-face { font-family: 'Lora'; src: url('0000000000000003.woff2') }",
        },
        head: '<link rel="stylesheet" href="describe-me-asset:0000000000000001.css">',
      }).fontsMissing,
      [],
    ),
)

check('without that head link, Lora is missing', () =>
  same(missingInCss('p { font-family: Lora }'), ['Lora']),
)

check('a head CSS asset with a remote Google @import covers the family', () =>
  same(
    audit({
      snapshots: { one: [style('p { font-family: Inter }')] },
      assets: {
        '0000000000000004.css': `@import url(${GOOGLE_INTER.replaceAll('&amp;', '&')});`,
      },
      head: '<link rel=stylesheet href=describe-me-asset:0000000000000004.css>',
    }).fontsMissing,
    [],
  ),
)

check('a head Google link with &amp; covers Inter', () =>
  same(
    missingInCss('p { font-family: Inter }', `<link rel="stylesheet" href="${GOOGLE_INTER}">`),
    [],
  ),
)

check('a head <style> @font-face covers the family, and a commented link does not load', () =>
  same(
    missingInCss(
      'p { font-family: Lora } code { font-family: Inter }',
      `<!-- <link rel="stylesheet" href="${GOOGLE_INTER}"> --><style>@font-face { font-family: Lora; src: url(x.woff2) }</style>`,
    ),
    ['Inter'],
  ),
)

check("the head's own font-family rules do not count as usage", () =>
  same(
    audit({
      snapshots: { one: [style('p { color: red }')] },
      head: '<style>body { font-family: Head Sans }</style>',
    }).fontsMissing,
    [],
  ),
)

check('a root-relative head link does not turn the audit off', () =>
  same(
    missingInCss(
      'p { font-family: Brand Sans }',
      '<link rel="stylesheet" href="/src/missing.css">',
    ),
    ['Brand Sans'],
  ),
)

// Remote stylesheets

check('remoteStylesheets leaves out loopback hosts and icon and modulepreload links', () =>
  same(
    hostsIn({
      snapshots: {
        one: [
          link('icon', 'http://localhost:63315/__vitest__/favicon.svg'),
          link('modulepreload', 'https://cdn.example.com/module.js'),
          link('stylesheet', 'http://localhost:5173/src/app.css'),
          link('stylesheet', 'http://127.0.0.1:5173/src/app.css'),
          link('stylesheet', 'http://[::1]:5173/src/app.css'),
          link('stylesheet', 'http://0.0.0.0:5173/src/app.css'),
        ],
      },
    }),
    [],
  ),
)

check('remoteStylesheets counts per frame, so two frames sharing one snapshot count 2', () =>
  same(
    hostsIn({
      snapshots: { shared: [link('stylesheet', 'https://cdn.example.com/theme.css')] },
      tests: [['shared', 'shared']],
    }),
    [{ host: 'cdn.example.com', frames: 2 }],
  ),
)

check('remoteStylesheets lists remote @imports and a protocol-relative link, never the head', () =>
  same(
    hostsIn({
      snapshots: {
        one: [
          style('@import "https://cdn.example.com/a.css";'),
          link('stylesheet', '//static.example.org/b.css'),
        ],
      },
      head: '<link rel="stylesheet" href="https://head.example.net/c.css">',
    }),
    [
      { host: 'cdn.example.com', frames: 1 },
      { host: 'static.example.org', frames: 1 },
    ],
  ),
)

// Aggregation

check('aggregation: sort order, one count per test and the first test id', () => {
  const result = audit({
    snapshots: {
      alpha: [style('p { font-family: Alpha Sans }')],
      both: [style('p { font-family: Beta Sans } code { font-family: Alpha Sans }')],
      beta: [style('p { font-family: beta-sans }')],
    },
    tests: [['beta', 'beta'], ['alpha', 'both'], ['both']],
  })

  return same(result.fontsMissing, [
    { family: 'beta-sans', tests: 3, testId: 'test-1' },
    { family: 'Alpha Sans', tests: 2, testId: 'test-2' },
  ])
})

check('aggregation: equal counts sort by family', () =>
  same(
    audit({
      snapshots: { one: [style('p { font-family: Zeta Sans } q { font-family: Eta Sans }')] },
    }).fontsMissing.map((font) => font.family),
    ['Eta Sans', 'Zeta Sans'],
  ),
)

check('aggregation: a missing snapshot file contributes nothing', () => {
  const { outDir, manifest } = fixture({ snapshots: {}, tests: [['gone']] })

  return same(new FontAudit(outDir).audit(manifest), { fontsMissing: [], remoteStylesheets: [] })
})

check('a manifest without the new fields gives [] from manifestDiagnostics', () => {
  const { fontsMissing, remoteStylesheets } = manifestDiagnostics({ modules: [], components: {} })

  return same([fontsMissing, remoteStylesheets], [[], []])
})

// Scale

{
  const chunkCount = 100
  const snapshotCount = 500
  const chunks = {}

  for (let i = 0; i < chunkCount; i++) {
    let css = ''
    for (let j = 0; css.length < 4096; j++) {
      css += `.rule-${i}-${j} { color: #${(j * 4099).toString(16).padStart(6, '0').slice(-6)}; font-family: Inter, sans-serif; margin: ${j}px }\n`
    }

    chunks[hexName(i)] = css
  }

  const snapshots = {}
  for (let i = 0; i < snapshotCount; i++) {
    const hashes = Array.from({ length: 10 }, (_, j) => hexName((i + j * 7) % chunkCount))
    snapshots[`s${i}`] = [style(`describe-me-style:${hashes.join('+')}`), styled(`width: ${i}px`)]
  }

  const { outDir, manifest } = fixture({
    snapshots,
    chunks,
    tests: Object.keys(snapshots).map((name) => [name]),
    head: `<link rel="stylesheet" href="${GOOGLE_INTER}">`,
  })

  const fonts = new FontAudit(outDir)
  let started = performance.now()
  const first = fonts.audit(manifest)
  const firstMs = performance.now() - started
  started = performance.now()
  fonts.audit(manifest)
  const secondMs = performance.now() - started

  check('scale: 500 snapshots sharing 100 chunks miss nothing', () => same(first.fontsMissing, []))
  console.log(
    `time  first audit: ${firstMs.toFixed(1)} ms, second audit: ${secondMs.toFixed(1)} ms`,
  )
}

for (const dir of directories) {
  rmSync(dir, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`check-font-audit: ${failures} failure(s)`)
  process.exit(1)
}

console.log('check-font-audit: ok')
