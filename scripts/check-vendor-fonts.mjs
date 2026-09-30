/**
 * Checks font vendoring in `describe-me build`, on the built CLI and without
 * network: the flag, the URL scanner, the rewrite of the preview head,
 * snapshots, style chunks and CSS assets, the move of rewritten chunks and CSS
 * assets to the hash of their new text, the recount of `remoteStylesheets`
 * against `FontAudit`, the allowlist, all-or-nothing stylesheets, redirects,
 * the cache, offline and repeated runs, and 0.4 data.
 * A fake fetch serves in-memory fixtures and the global fetch throws. Every
 * run works on its own copy of a fixture data directory. Run after
 * `pnpm build`.
 *
 * Usage: `node scripts/check-vendor-fonts.mjs`
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { cssReferences } from '../packages/core/dist/css-references.js'
import { FontAudit } from '../packages/vitest/dist/font-audit.js'
import { CHROME_USER_AGENT } from '../packages/viewer/dist-cli/chrome-user-agent.js'
import { findRemoteUrls } from '../packages/viewer/dist-cli/find-remote-urls.js'
import { parseArgs } from '../packages/viewer/dist-cli/parse-args.js'
import { vendorFonts } from '../packages/viewer/dist-cli/vendor-fonts.js'

globalThis.fetch = () => {
  throw new Error('check-vendor-fonts: the real network is off')
}

const ASSET_URL = /describe-me-asset:([0-9a-f]{16}\.[a-z0-9]+)/g
const ASSET_CSS_HREF = /^describe-me-asset:[0-9a-f]{16}\.css$/
const CSS_NAME = /^[0-9a-f]{16}\.css$/
const ASSET_NAME = /^[0-9a-f]{16}\.[a-z0-9]+$/
const SIBLING_NAME = /^[0-9a-f]{16}(\.[a-z0-9]+)?$/
const STYLE_URL = /describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)/g
const DAY_MS = 24 * 60 * 60 * 1000

const GOOGLE = 'https://fonts.googleapis.com'
const GSTATIC = 'https://fonts.gstatic.com'
const JSDELIVR = 'https://cdn.jsdelivr.net'

/** Every URL of the fixtures, as requested. */
const URLS = {
  head: `${GOOGLE}/css2?family=Inter:wght@400;600&display=swap`,
  typekit: 'https://use.typekit.net/abc1234.css',
  roboto: `${GOOGLE}/css2?family=Roboto:wght@400;700&display=swap`,
  lato: `${GOOGLE}/css?family=Lato`,
  lora: `${GOOGLE}/css2?family=Lora:wght@400;700&display=swap`,
  inlined: `${GSTATIC}/s/inter/v20/inlined-latin.woff2`,
  chunk: `${GSTATIC}/s/inter/v20/chunk-latin.woff2`,
  fontsource: `${JSDELIVR}/npm/@fontsource/inter@5.2.0/index.css`,
  fontsourceFont: `${JSDELIVR}/npm/@fontsource/inter@5.2.0/files/inter-latin-400-normal.woff2`,
  nested: `${JSDELIVR}/npm/@fontsource/lora@5.2.0/index.css`,
  nestedChild: `${JSDELIVR}/npm/@fontsource/lora@5.2.0/latin.css`,
  nestedFont: `${JSDELIVR}/npm/@fontsource/lora@5.2.0/files/lora-latin-400-normal.woff2`,
  cycleA: `${JSDELIVR}/npm/@fontsource/cycle@1.0.0/a.css`,
  cycleB: `${JSDELIVR}/npm/@fontsource/cycle@1.0.0/b.css`,
  failHtmlFont: `${GOOGLE}/css2?family=FailHtml`,
  failMissingFont: `${GOOGLE}/css2?family=FailMissing`,
  failType: `${GOOGLE}/css2?family=FailType`,
  failBigFont: `${GOOGLE}/css2?family=FailBig`,
  moved: `${GOOGLE}/css2?family=Moved`,
  movedTarget: `${JSDELIVR}/npm/@fontsource/moved@5.2.0/index.css`,
  movedFont: `${JSDELIVR}/npm/@fontsource/moved@5.2.0/files/moved-latin-400-normal.woff2`,
  away: `${GOOGLE}/css2?family=Away`,
  awayTarget: 'https://fonts.example.net/away.css',
  loopback: 'http://localhost:63315/src/theme.css',
  image: 'https://images.example.com/photo.png',
  unknownCss: 'https://cdn.example.com/theme.css',
}

const FAIL_FONTS = {
  htmlGood: `${GSTATIC}/s/fail/html-good.woff2`,
  htmlPage: `${GSTATIC}/s/fail/html-page.woff2`,
  missingGood: `${GSTATIC}/s/fail/missing-good.woff2`,
  missing: `${GSTATIC}/s/fail/missing.woff2`,
  typeGood: `${GSTATIC}/s/fail/type-good.woff2`,
  bigGood: `${GSTATIC}/s/fail/big-good.woff2`,
  big: `${GSTATIC}/s/fail/big.woff2`,
}

const FAILING_STYLESHEETS = [
  URLS.failHtmlFont,
  URLS.failMissingFont,
  URLS.failType,
  URLS.failBigFont,
]

/** What a run over its own output may request again: the URLs whose answer did not validate. */
const FAILED_ANSWERS = new Set([
  URLS.failType,
  FAIL_FONTS.htmlPage,
  FAIL_FONTS.missing,
  FAIL_FONTS.big,
  URLS.away,
])

/** A Google-style stylesheet: one `@font-face` per `unicode-range` subset. */
function faces(family, urls) {
  return urls
    .map((url, i) => {
      return [
        '@font-face {',
        `  font-family: '${family}';`,
        `  src: url(${url}) format('woff2');`,
        `  unicode-range: U+00${i}0-00${i}F;`,
        '}',
      ].join('\n')
    })
    .join('\n')
}

function css(text) {
  return { kind: 'css', status: 200, headers: { 'content-type': 'text/css; charset=utf-8' }, text }
}

/** Font bodies are small and start with the woff2 signature. */
function font(label) {
  return {
    kind: 'font',
    status: 200,
    headers: { 'content-type': 'font/woff2' },
    text: `wOF2${label}`,
  }
}

function redirect(status, location) {
  return { kind: 'redirect', status, headers: { location }, text: null }
}

/** A Google font URL without an extension. */
const ROBOTO_KIT = `${GSTATIC}/l/font?kit=roboto-kit&skey=abc&v=v1`

const HEAD_FONTS = [
  `${GSTATIC}/s/inter/v20/head-latin.woff2`,
  `${GSTATIC}/s/inter/v20/head-latin-ext.woff2`,
]

const FONT_BODIES = {
  [HEAD_FONTS[0]]: 'head latin',
  [HEAD_FONTS[1]]: 'head latin-ext',
  [ROBOTO_KIT]: 'roboto kit',
  [`${GSTATIC}/s/lato/v1/lato-latin.woff2`]: 'lato latin',
  [`${GSTATIC}/s/lora/v1/lora-latin.woff2`]: 'lora latin',
  [URLS.inlined]: 'inter inlined',
  [URLS.chunk]: 'inter chunk',
  [URLS.fontsourceFont]: 'fontsource inter',
  [URLS.nestedFont]: 'fontsource lora',
  [URLS.movedFont]: 'fontsource moved',
  [FAIL_FONTS.htmlGood]: 'fail html good',
  [FAIL_FONTS.missingGood]: 'fail missing good',
  [FAIL_FONTS.typeGood]: 'fail type good',
  [FAIL_FONTS.bigGood]: 'fail big good',
}

const RESPONSES = new Map([
  [URLS.head, css(faces('Inter', HEAD_FONTS))],
  [URLS.roboto, css(faces('Roboto', [ROBOTO_KIT]))],
  [URLS.lato, css(faces('Lato', [`${GSTATIC}/s/lato/v1/lato-latin.woff2`]))],
  [URLS.lora, css(faces('Lora', [`${GSTATIC}/s/lora/v1/lora-latin.woff2`]))],
  [URLS.fontsource, css(faces('Inter', ['./files/inter-latin-400-normal.woff2']))],
  [URLS.nested, css('@import "./latin.css";\n')],
  [URLS.nestedChild, css(faces('Lora', ['./files/lora-latin-400-normal.woff2']))],
  [URLS.cycleA, css('@import url(b.css);\n.a { color: red; }')],
  [URLS.cycleB, css('@import "a.css";\n.b { color: blue; }')],
  [URLS.failHtmlFont, css(faces('FailHtml', [FAIL_FONTS.htmlGood, FAIL_FONTS.htmlPage]))],
  [URLS.failMissingFont, css(faces('FailMissing', [FAIL_FONTS.missingGood, FAIL_FONTS.missing]))],
  [
    URLS.failType,
    { ...css(faces('FailType', [FAIL_FONTS.typeGood])), headers: { 'content-type': 'text/html' } },
  ],
  [URLS.failBigFont, css(faces('FailBig', [FAIL_FONTS.bigGood, FAIL_FONTS.big]))],
  [URLS.moved, redirect(301, URLS.movedTarget.replace(/^https:/, 'http:'))],
  [URLS.movedTarget, css(faces('Moved', ['./files/moved-latin-400-normal.woff2']))],
  [URLS.away, redirect(302, URLS.awayTarget)],
  [URLS.awayTarget, css(faces('Away', [`${GSTATIC}/s/away/away.woff2`]))],
  ...Object.entries(FONT_BODIES).map(([url, label]) => [url, font(label)]),
  [
    FAIL_FONTS.htmlPage,
    {
      kind: 'font',
      status: 200,
      headers: { 'content-type': 'text/html' },
      text: '<!doctype html>',
    },
  ],
  [FAIL_FONTS.missing, { ...font('missing'), status: 404 }],
  [
    FAIL_FONTS.big,
    {
      ...font('fail big'),
      headers: { 'content-type': 'font/woff2', 'content-length': '20000000' },
    },
  ],
])

function dnsFailure() {
  const cause = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })

  return new TypeError('fetch failed', { cause })
}

/** Serves the fixtures and records every request. Anything else fails like a DNS lookup. */
function fakeFetch(requests) {
  return async (url, init) => {
    requests.push({ url, init })
    const response = RESPONSES.get(url)
    if (response === undefined) {
      throw dnsFailure()
    }

    return new Response(response.text, { status: response.status, headers: response.headers })
  }
}

function offlineFetch() {
  return async () => {
    throw dnsFailure()
  }
}

function throwingFetch() {
  throw new Error('this run must use the cache only')
}

function contentHash(content) {
  return createHash('sha1').update(content).digest('hex').slice(0, 16)
}

function headWith(stylesheetHref) {
  return [
    `<link rel="preconnect" href="${GSTATIC}" crossorigin>`,
    `<link rel="stylesheet" href="${stylesheetHref}">`,
    `<link rel="stylesheet" href="${URLS.typekit}">`,
  ].join('\n')
}

const HEAD_AS_WRITTEN = URLS.head.replaceAll('&', '&amp;')

function withoutKeys(object, keys) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))
}

const MANIFEST_REST = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  modules: [
    {
      id: 'src/Card.test.tsx',
      tests: [
        {
          fullName: 'Card > renders',
          frames: [
            { id: 'f0', snapshot: 'snapshots/a.json' },
            { id: 'f1', snapshot: 'snapshots/b.json' },
            { id: 'f2', snapshot: 'snapshots/c.json' },
          ],
        },
      ],
    },
  ],
  components: { Card: { file: 'src/Card.tsx', props: [] } },
  remoteStylesheets: [
    { host: 'fonts.googleapis.com', frames: 3 },
    { host: 'cdn.jsdelivr.net', frames: 2 },
    { host: 'cdn.example.com', frames: 1 },
  ],
}

/** What frames still load after vendoring: the unknown host, the import cycle and the failures. */
const REMOTE_AFTER = [
  { host: 'cdn.example.com', frames: 1 },
  { host: 'cdn.jsdelivr.net', frames: 1 },
  { host: 'fonts.googleapis.com', frames: 1 },
]

/** A 0.4 manifest: no head and no `remoteStylesheets`. */
const LEGACY_MANIFEST = {
  ...withoutKeys(MANIFEST_REST, ['modules', 'remoteStylesheets']),
  modules: [
    {
      id: 'src/Card.test.tsx',
      tests: [{ fullName: 'Card > renders', frames: [{ id: 'f0', snapshot: 'snapshots/a.json' }] }],
    },
  ],
}

const CHUNK_CSS = [
  '@font-face {',
  "  font-family: 'Inter';",
  `  src: url(${URLS.chunk}) format('woff2');`,
  '}',
].join('\n')

const CHUNK_NAME = `${contentHash(CHUNK_CSS)}.css`

const ASSET_CSS = `@import url("${URLS.fontsource}");\nbody { font-family: Inter, sans-serif; }`
const ASSET_CSS_NAME = `${contentHash(ASSET_CSS)}.css`

const INLINED_CSS = `@font-face { font-family: Inter; src: url("${URLS.inlined}") format("woff2"); }`

/** A chunk that reaches Lora through two CSS assets, and a chunk that names nothing. */
const INNER_CSS = `@import url(${URLS.lora});\n.inner { color: teal; }`
const INNER_NAME = `${contentHash(INNER_CSS)}.css`
const OUTER_CSS = `@import "${INNER_NAME}";\n.outer { color: navy; }`
const OUTER_NAME = `${contentHash(OUTER_CSS)}.css`
const CASCADE_CHUNK_CSS = `@import url(describe-me-asset:${OUTER_NAME});\n.cascade { margin: 0; }`
const CASCADE_CHUNK_NAME = `${contentHash(CASCADE_CHUNK_CSS)}.css`
const PLAIN_CHUNK_CSS = '.plain { padding: 0; }'
const PLAIN_CHUNK_NAME = `${contentHash(PLAIN_CHUNK_CSS)}.css`

/** A CSS asset of the project that imports a Google stylesheet. */
const LOCAL_CSS = `@import url("${URLS.head}");\n.local { color: olive; }`
const LOCAL_NAME = `${contentHash(LOCAL_CSS)}.css`
const GOOGLE_ONLY = [{ host: 'fonts.googleapis.com', frames: 1 }]

function element(tagName, attributes, childNodes = []) {
  return { type: 2, tagName, attributes, childNodes }
}

function link(href) {
  return element('link', { rel: 'stylesheet', href })
}

function documentOf(headNodes, bodyNodes = []) {
  return {
    type: 0,
    childNodes: [
      element('html', {}, [element('head', {}, headNodes), element('body', {}, bodyNodes)]),
    ],
  }
}

/** The fonts of the manifest's test page, as jsdom and browser mode record them. */
const SNAPSHOT_A = documentOf(
  [
    link(URLS.roboto),
    link(URLS.lato.replace(/^https:/, 'http:')),
    element('style', { _cssText: `@import url(${URLS.lora});` }),
    element('style', { _cssText: INLINED_CSS }),
    element('style', { _cssText: `describe-me-style:${CHUNK_NAME.slice(0, 16)}` }),
    link(`describe-me-asset:${ASSET_CSS_NAME}`),
    link(URLS.loopback),
    link(URLS.unknownCss),
  ],
  [element('img', { src: URLS.image })],
)

/** The nested, cyclic, failing and redirected stylesheets, and a protocol-relative link. */
const SNAPSHOT_B = documentOf([
  link(URLS.roboto.replace(/^https:/, '')),
  link(URLS.nested),
  link(URLS.cycleA),
  ...FAILING_STYLESHEETS.map(link),
  link(URLS.moved),
  link(URLS.away),
])

/** Two chunks in one reference, the plain one first. */
const SNAPSHOT_C = documentOf([
  element('style', {
    _cssText: `describe-me-style:${PLAIN_CHUNK_NAME.slice(0, 16)}+${CASCADE_CHUNK_NAME.slice(0, 16)}`,
  }),
])

/** A preconnect, a test-server link and a project CSS asset that imports Google. */
const SNAPSHOT_LOCAL = documentOf([
  element('link', { rel: 'preconnect', href: GOOGLE }),
  link('http://0.0.0.0:5173/src/theme.css'),
  link(`describe-me-asset:${LOCAL_NAME}`),
])

const directories = []
let checks = 0
let failures = 0

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-vendor-'))
  directories.push(dir)

  return dir
}

function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
}

/** A data directory as the reporter writes it, with remote fonts in every place they occur. */
function fixture() {
  const dir = tempDir()
  writeFiles(dir, {
    'manifest.json': JSON.stringify({ ...MANIFEST_REST, head: headWith(HEAD_AS_WRITTEN) }, null, 2),
    'snapshots/a.json': JSON.stringify(SNAPSHOT_A),
    'snapshots/b.json': JSON.stringify(SNAPSHOT_B),
    'snapshots/c.json': JSON.stringify(SNAPSHOT_C),
    [`styles/${CHUNK_NAME}`]: CHUNK_CSS,
    [`styles/${CASCADE_CHUNK_NAME}`]: CASCADE_CHUNK_CSS,
    [`styles/${PLAIN_CHUNK_NAME}`]: PLAIN_CHUNK_CSS,
    [`assets/${ASSET_CSS_NAME}`]: ASSET_CSS,
    [`assets/${INNER_NAME}`]: INNER_CSS,
    [`assets/${OUTER_NAME}`]: OUTER_CSS,
  })

  return dir
}

/** One frame whose only remote stylesheet is imported by a CSS asset that the head links too. */
function localAssetFixture() {
  const dir = tempDir()
  const manifest = {
    ...LEGACY_MANIFEST,
    head: `<link rel="stylesheet" href="describe-me-asset:${LOCAL_NAME}">`,
    remoteStylesheets: GOOGLE_ONLY,
  }

  writeFiles(dir, {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'snapshots/a.json': JSON.stringify(SNAPSHOT_LOCAL),
    [`assets/${LOCAL_NAME}`]: LOCAL_CSS,
  })

  return dir
}

/** A 0.4 data directory: no `styles/`, every `_cssText` inline, however long. */
function legacyFixture() {
  const dir = tempDir()
  const padding = Array.from({ length: 12 }, (_, i) => `.card-${i} { padding: ${i}px; }`)
  const cssText = [`@import url(${URLS.lora});`, INLINED_CSS, ...padding].join('\n')
  const manifest = JSON.stringify(LEGACY_MANIFEST, null, 2)
  writeFiles(dir, {
    'manifest.json': manifest,
    'snapshots/a.json': JSON.stringify(documentOf([element('style', { _cssText: cssText })])),
  })

  return { dir, cssText, manifest }
}

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
  const suffix = detail ? ` (${detail})` : ''
  checks++
  if (!passed) {
    failures++
  }

  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${name}${suffix}`)
}

function filesUnder(root) {
  if (!existsSync(root)) {
    return []
  }

  return readdirSync(root, { recursive: true })
    .map((path) => join(root, path))
    .filter((path) => statSync(path).isFile())
}

/** Every file of a directory by relative path, with the hash of its bytes. */
function treeOf(root) {
  const tree = new Map()
  for (const file of filesUnder(root)) {
    tree.set(relative(root, file), createHash('sha1').update(readFileSync(file)).digest('hex'))
  }

  return tree
}

function treeDifference(left, right) {
  const paths = new Set([...left.keys(), ...right.keys()])

  return [...paths].filter((path) => left.get(path) !== right.get(path)).sort()
}

function sameTree(left, right) {
  const differing = treeDifference(left, right)

  return {
    passed: differing.length === 0,
    detail: differing.length === 0 ? `${left.size} files` : `differs: ${differing.join(', ')}`,
  }
}

function readText(dir, path) {
  return readFileSync(join(dir, path), 'utf8')
}

function readAsset(dir, name) {
  const file = join(dir, 'assets', name)

  return existsSync(file) ? readFileSync(file) : null
}

function assetNamesIn(text) {
  return Array.from(text.matchAll(ASSET_URL), (match) => match[1])
}

function styleHashesIn(text) {
  return Array.from(text.matchAll(STYLE_URL), (match) => match[1].split('+')).flat()
}

/** The bare sibling names a stored CSS file refers to, without query or fragment. */
function bareSiblingsIn(css) {
  return cssReferences(css)
    .map(({ url }) => url.split(/[?#]/)[0])
    .filter((name) => SIBLING_NAME.test(name))
}

function hostList(list) {
  return list.map(({ host, frames }) => `${host} ${frames}`).join(', ')
}

function hostsIn(text, syntax) {
  return findRemoteUrls(text, syntax).map((found) => new URL(found.url).hostname)
}

function isFontAsset(dir, name) {
  const bytes = readAsset(dir, name)

  return bytes !== null && bytes.subarray(0, 4).toString('latin1') === 'wOF2'
}

/** The targets of a stored CSS file, and whether each is a sibling that exists. */
function siblingsOf(dir, name) {
  const bytes = readAsset(dir, name)
  const urls = bytes === null ? [] : cssReferences(bytes.toString('utf8')).map(({ url }) => url)

  return { urls, stored: urls.every((url) => ASSET_NAME.test(url) && readAsset(dir, url) !== null) }
}

/** The one font a stored CSS file reaches through its siblings, read as text. */
function fontTextBehind(dir, name, depth = 0) {
  const { urls } = siblingsOf(dir, name)
  const [first] = urls
  if (first === undefined || depth > 3) {
    return null
  }

  if (first.endsWith('.css')) {
    return fontTextBehind(dir, first, depth + 1)
  }

  return readAsset(dir, first)?.toString('latin1') ?? null
}

function snapshotHead(dir, path) {
  const [html] = JSON.parse(readText(dir, path)).childNodes

  return html.childNodes[0].childNodes
}

function requestedUrls(requests) {
  return requests.map((request) => request.url)
}

function requestedSet(requests) {
  return new Set(requestedUrls(requests))
}

function isFontUrl(url) {
  return RESPONSES.get(url)?.kind === 'font'
}

async function withinSeconds(seconds, promise) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`did not settle within ${seconds} s`)),
      seconds * 1000,
    )
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function checkParseArgs() {
  await check('parseArgs: build vendors by default, --no-vendor-fonts turns it off', () => {
    const on = parseArgs(['build']).vendorFonts
    const off = parseArgs(['build', '--no-vendor-fonts']).vendorFonts

    return { passed: on === true && off === false, detail: `${on} / ${off}` }
  })
}

async function checkFindRemoteUrls() {
  const google = `${GOOGLE}/css2?family=X:wght@400;700&display=swap`

  await check('findRemoteUrls reads an unquoted @import url(…;…&…) whole', () => {
    const found = findRemoteUrls(`@import url(${google});`, 'css')

    return {
      passed: found.length === 1 && found[0].raw === google && found[0].url === google,
      detail: found.map((hit) => hit.raw).join(', '),
    }
  })

  await check('findRemoteUrls stops at \\" in JSON', () => {
    const text = JSON.stringify({ _cssText: `src: url("${URLS.inlined}") format("woff2")` })
    const found = findRemoteUrls(text, 'json')

    return { passed: found.length === 1 && found[0].raw === URLS.inlined, detail: found[0]?.raw }
  })

  await check('findRemoteUrls decodes &amp; in html and keeps it in raw', () => {
    const found = findRemoteUrls(`<link rel="stylesheet" href="${HEAD_AS_WRITTEN}">`, 'html')

    return {
      passed: found.length === 1 && found[0].raw === HEAD_AS_WRITTEN && found[0].url === URLS.head,
      detail: found[0]?.url,
    }
  })

  await check('findRemoteUrls turns //host and http: into https:', () => {
    const text = 'url(//fonts.bunny.net/css?family=a) url(http://fonts.googleapis.com/css?family=b)'
    const urls = findRemoteUrls(text, 'css').map((hit) => hit.url)
    const expected = ['https://fonts.bunny.net/css?family=a', `${GOOGLE}/css?family=b`]

    return { passed: isDeepStrictEqual(urls, expected), detail: urls.join(', ') }
  })

  await check('findRemoteUrls finds nothing in a//b, and slice(start, end) === raw', () => {
    const none = findRemoteUrls('a//b and x://y', 'css')
    const text = `@import url(${google}); a { background: url("//cdn.example.com/x.png") }`
    const found = findRemoteUrls(text, 'css')
    const exact = found.every((hit) => text.slice(hit.start, hit.end) === hit.raw)

    return {
      passed: none.length === 0 && found.length === 2 && exact,
      detail: `${none.length} in a//b`,
    }
  })
}

async function checkHead(dir, requests) {
  await check(
    'the head: the &amp; link becomes one describe-me-asset:, the rest is unchanged',
    () => {
      const manifest = JSON.parse(readText(dir, 'manifest.json'))
      const { head } = manifest
      const rest = withoutKeys(manifest, ['head', 'remoteStylesheets'])
      const [name] = assetNamesIn(head)

      return {
        passed:
          name !== undefined &&
          name.endsWith('.css') &&
          head === headWith(`describe-me-asset:${name}`) &&
          requestedSet(requests).has(URLS.head) &&
          !requestedUrls(requests).some((url) => url.includes('&amp;')) &&
          isDeepStrictEqual(rest, withoutKeys(MANIFEST_REST, ['remoteStylesheets'])),
        detail: head.replaceAll('\n', ' '),
      }
    },
  )

  await check(
    'the vendored head CSS names its fonts by bare sibling names, all stored woff2',
    () => {
      const [name] = assetNamesIn(JSON.parse(readText(dir, 'manifest.json')).head)
      const { urls, stored } = siblingsOf(dir, name)

      return {
        passed: urls.length === 2 && stored && urls.every((url) => isFontAsset(dir, url)),
        detail: urls.join(', '),
      }
    },
  )
}

async function checkSnapshot(dir) {
  await check(
    'snapshot: href, http:// link, unquoted @import and inlined gstatic URL are vendored',
    () => {
      const text = readText(dir, 'snapshots/a.json')
      const [roboto, lato, lora, inlined] = snapshotHead(dir, 'snapshots/a.json')
      const names = assetNamesIn(text)
      const importName = assetNamesIn(lora.attributes._cssText)[0]
      const fontName = assetNamesIn(inlined.attributes._cssText)[0]
      const left = new Set(hostsIn(text, 'json'))
      const expectedLeft = new Set(['localhost', 'cdn.example.com', 'images.example.com'])

      return {
        passed:
          ASSET_CSS_HREF.test(roboto.attributes.href) &&
          ASSET_CSS_HREF.test(lato.attributes.href) &&
          lora.attributes._cssText === `@import url(describe-me-asset:${importName});` &&
          inlined.attributes._cssText ===
            INLINED_CSS.replaceAll(URLS.inlined, `describe-me-asset:${fontName}`) &&
          isFontAsset(dir, fontName) &&
          names.every((name) => readAsset(dir, name) !== null) &&
          isDeepStrictEqual(left, expectedLeft),
        detail: `${names.length} asset URLs, left ${[...left].join(', ')}`,
      }
    },
  )

  await check(
    'the style chunk moves to the hash of its new text, its gstatic URL is a describe-me-asset:',
    () => {
      const [, , , , style] = snapshotHead(dir, 'snapshots/a.json')
      const [hash] = styleHashesIn(style.attributes._cssText)
      const bytes = readFileSync(join(dir, 'styles', `${hash}.css`))
      const chunk = bytes.toString('utf8')
      const [name] = assetNamesIn(chunk)

      return {
        passed:
          !existsSync(join(dir, 'styles', CHUNK_NAME)) &&
          hash === contentHash(bytes) &&
          chunk === CHUNK_CSS.replaceAll(URLS.chunk, `describe-me-asset:${name}`) &&
          isFontAsset(dir, name),
        detail: `${CHUNK_NAME} → ${hash}.css`,
      }
    },
  )

  await check(
    'the CSS asset moves to the hash of its new text and @imports the jsDelivr copy as a sibling, ./files/ resolved on jsDelivr',
    () => {
      const [, , , , , assetLink] = snapshotHead(dir, 'snapshots/a.json')
      const [name] = assetNamesIn(assetLink.attributes.href)
      const bytes = readAsset(dir, name)
      const asset = bytes.toString('utf8')
      const [imported] = cssReferences(asset).map(({ url }) => url)

      return {
        passed:
          readAsset(dir, ASSET_CSS_NAME) === null &&
          name === `${contentHash(bytes)}.css` &&
          ASSET_NAME.test(imported) &&
          asset === ASSET_CSS.replaceAll(URLS.fontsource, imported) &&
          fontTextBehind(dir, imported) === `wOF2${FONT_BODIES[URLS.fontsourceFont]}`,
        detail: `${ASSET_CSS_NAME} → ${name}`,
      }
    },
  )
}

async function checkCascade(dir) {
  await check(
    'a chunk → CSS asset → CSS asset cascade moves all three to new hashes, the plain chunk stays',
    () => {
      const [style] = snapshotHead(dir, 'snapshots/c.json')
      const [plain, cascade] = styleHashesIn(style.attributes._cssText)
      const chunk = readText(dir, `styles/${cascade}.css`)
      const [outer] = assetNamesIn(chunk)
      const outerCss = readAsset(dir, outer).toString('utf8')
      const [inner] = cssReferences(outerCss).map(({ url }) => url)
      const innerCss = readAsset(dir, inner).toString('utf8')
      const [, , lora] = snapshotHead(dir, 'snapshots/a.json')
      const [loraName] = assetNamesIn(lora.attributes._cssText)
      const replaced = [
        `assets/${INNER_NAME}`,
        `assets/${OUTER_NAME}`,
        `styles/${CASCADE_CHUNK_NAME}`,
      ]

      const left = replaced.filter((path) => existsSync(join(dir, path)))

      return {
        passed:
          plain === PLAIN_CHUNK_NAME.slice(0, 16) &&
          readText(dir, `styles/${PLAIN_CHUNK_NAME}`) === PLAIN_CHUNK_CSS &&
          cascade !== CASCADE_CHUNK_NAME.slice(0, 16) &&
          chunk === CASCADE_CHUNK_CSS.replace(OUTER_NAME, outer) &&
          outer !== OUTER_NAME &&
          outerCss === OUTER_CSS.replace(INNER_NAME, inner) &&
          inner !== INNER_NAME &&
          CSS_NAME.test(inner) &&
          innerCss === INNER_CSS.replace(URLS.lora, loraName) &&
          left.length === 0,
        detail: left.length === 0 ? `${cascade} → ${outer} → ${inner}` : `left: ${left.join(', ')}`,
      }
    },
  )
}

async function checkReferences(dir) {
  await check('every file in styles/ and assets/ is named after the sha1-16 of its bytes', () => {
    const files = [...filesUnder(join(dir, 'styles')), ...filesUnder(join(dir, 'assets'))]
    const misnamed = files.filter((file) => {
      return basename(file) !== `${contentHash(readFileSync(file))}${extname(file)}`
    })

    return {
      passed: files.length > 0 && misnamed.length === 0,
      detail:
        misnamed.length === 0
          ? `${files.length} files`
          : `misnamed: ${misnamed.map((file) => relative(dir, file)).join(', ')}`,
    }
  })

  const snapshots = filesUnder(join(dir, 'snapshots')).map((file) => readFileSync(file, 'utf8'))
  const chunkNames = readdirSync(join(dir, 'styles'))

  await check(
    'every describe-me-style: hash names a chunk, every chunk is named by a snapshot',
    () => {
      const named = new Set(snapshots.flatMap(styleHashesIn).map((hash) => `${hash}.css`))
      const problems = [
        ...[...named].filter((name) => !chunkNames.includes(name)).map((name) => `${name} missing`),
        ...chunkNames.filter((name) => !named.has(name)).map((name) => `${name} unnamed`),
      ]

      return {
        passed: named.size > 0 && problems.length === 0,
        detail: problems.join(', ') || `${named.size} chunks`,
      }
    },
  )

  await check(
    'every describe-me-asset: name and every bare sibling of a CSS asset is stored',
    () => {
      const chunks = chunkNames.map((name) => readText(dir, `styles/${name}`))
      const { head } = JSON.parse(readText(dir, 'manifest.json'))
      const linked = [...snapshots, ...chunks, head].flatMap(assetNamesIn)
      const cssAssets = readdirSync(join(dir, 'assets')).filter((name) => name.endsWith('.css'))
      const siblings = cssAssets.flatMap((name) => bareSiblingsIn(readText(dir, `assets/${name}`)))
      const missing = [...new Set([...linked, ...siblings])].filter((name) => {
        return readAsset(dir, name) === null
      })

      return {
        passed: linked.length > 0 && siblings.length > 0 && missing.length === 0,
        detail:
          missing.length === 0
            ? `${linked.length} links, ${siblings.length} siblings`
            : `missing: ${missing.join(', ')}`,
      }
    },
  )
}

async function checkRecount(dir) {
  await check("FontAudit counts the fixture's remoteStylesheets before vendoring", () => {
    const fresh = fixture()
    const counted = new FontAudit(fresh).audit(JSON.parse(readText(fresh, 'manifest.json')))

    return {
      passed: isDeepStrictEqual(counted.remoteStylesheets, MANIFEST_REST.remoteStylesheets),
      detail: hostList(counted.remoteStylesheets),
    }
  })

  await check('remoteStylesheets is counted again, as FontAudit counts the vendored files', () => {
    const manifest = JSON.parse(readText(dir, 'manifest.json'))
    const audited = new FontAudit(dir).audit(manifest).remoteStylesheets

    return {
      passed:
        isDeepStrictEqual(manifest.remoteStylesheets, REMOTE_AFTER) &&
        isDeepStrictEqual(audited, REMOTE_AFTER),
      detail: `${hostList(manifest.remoteStylesheets)} / FontAudit: ${hostList(audited)}`,
    }
  })

  await check(
    'a host drops out despite a preconnect and a 0.0.0.0 link, the head follows the new CSS asset',
    async () => {
      const local = localAssetFixture()
      const before = new FontAudit(local).audit(JSON.parse(readText(local, 'manifest.json')))
      await vendorFonts(local, { cacheDir: tempDir(), fetch: fakeFetch([]) })
      const manifest = JSON.parse(readText(local, 'manifest.json'))
      const [, , assetLink] = snapshotHead(local, 'snapshots/a.json')
      const [linked] = assetNamesIn(assetLink.attributes.href)

      return {
        passed:
          isDeepStrictEqual(before.remoteStylesheets, GOOGLE_ONLY) &&
          isDeepStrictEqual(manifest.remoteStylesheets, []) &&
          linked !== undefined &&
          linked !== LOCAL_NAME &&
          isDeepStrictEqual(assetNamesIn(manifest.head), [linked]) &&
          readAsset(local, linked) !== null &&
          readAsset(local, LOCAL_NAME) === null,
        detail: `${hostList(before.remoteStylesheets)} → [${hostList(manifest.remoteStylesheets)}]`,
      }
    },
  )
}

async function checkNestedAndCycle(dir, report) {
  const [protocolRelative, nested, cycle] = snapshotHead(dir, 'snapshots/b.json')

  await check('a protocol-relative link is vendored like its https: twin', () => {
    const [roboto] = snapshotHead(dir, 'snapshots/a.json')

    return {
      passed:
        ASSET_CSS_HREF.test(protocolRelative.attributes.href) &&
        protocolRelative.attributes.href === roboto.attributes.href,
      detail: protocolRelative.attributes.href,
    }
  })

  await check('a nested jsDelivr @import is vendored as a sibling with its font', () => {
    const [name] = assetNamesIn(nested.attributes.href)
    const { urls, stored } = siblingsOf(dir, name)

    return {
      passed:
        urls.length === 1 &&
        stored &&
        fontTextBehind(dir, name) === `wOF2${FONT_BODIES[URLS.nestedFont]}`,
      detail: urls.join(', '),
    }
  })

  await check('an a.css ⇄ b.css import cycle ends as a failure and stays remote', () => {
    const failure = report.failures.find(({ url }) => url === URLS.cycleA)

    return {
      passed: cycle.attributes.href === URLS.cycleA && failure !== undefined,
      detail: failure?.reason,
    }
  })
}

async function checkReport(report, requests) {
  const hosts = requestedUrls(requests).map((url) => new URL(url).hostname)

  await check(
    'Typekit and the unknown .css host are left remote, Typekit is never requested',
    () => {
      const expected = [
        { host: 'cdn.example.com', reason: 'not on the font allowlist' },
        { host: 'use.typekit.net', reason: 'Adobe Fonts do not allow self-hosting' },
      ]

      return {
        passed:
          isDeepStrictEqual(report.leftRemote, expected) &&
          !hosts.some((host) => host === 'use.typekit.net'),
        detail: report.leftRemote.map(({ host, reason }) => `${host}: ${reason}`).join(', '),
      }
    },
  )

  await check('loopback and image URLs are neither reported nor requested', () => {
    const quiet = new Set(['localhost', 'images.example.com', 'cdn.example.com'])

    return !hosts.some((host) => quiet.has(host))
  })

  await check('every request used https:, the Chrome User-Agent and manual redirects', () => {
    const wrong = requests.filter(({ url, init }) => {
      return (
        new URL(url).protocol !== 'https:' ||
        new Headers(init?.headers).get('user-agent') !== CHROME_USER_AGENT ||
        init?.redirect !== 'manual'
      )
    })

    return {
      passed: requests.length > 0 && wrong.length === 0,
      detail: `${requests.length} requests`,
    }
  })
}

async function checkFailures(dir, report) {
  const snapshot = readText(dir, 'snapshots/b.json')
  const remote = new Set(findRemoteUrls(snapshot, 'json').map(({ url }) => url))
  const assets = filesUnder(join(dir, 'assets')).map((file) => readFileSync(file, 'latin1'))

  for (const url of FAILING_STYLESHEETS) {
    const family = new URL(url).searchParams.get('family')

    await check(`${family}: stays remote, is reported and adds no file`, () => {
      const failure = report.failures.find((entry) => entry.url === url)
      const marker = `fail ${family.slice('Fail'.length).toLowerCase()}`

      return {
        passed:
          remote.has(url) &&
          failure !== undefined &&
          !assets.some((content) => content.includes(marker) || content.includes(`'${family}'`)),
        detail: failure?.reason,
      }
    })
  }
}

async function checkRedirects(dir, report, requests) {
  const [, , , , , , , moved, away] = snapshotHead(dir, 'snapshots/b.json')

  await check('a redirect to an allowlisted stylesheet is vendored against its final URL', () => {
    const [name] = assetNamesIn(moved.attributes.href)

    return {
      passed:
        name !== undefined &&
        requestedSet(requests).has(URLS.movedTarget) &&
        fontTextBehind(dir, name) === `wOF2${FONT_BODIES[URLS.movedFont]}`,
      detail: moved.attributes.href,
    }
  })

  await check('a redirect off the allowlist is never requested and stays remote', () => {
    const failure = report.failures.find(({ url }) => url === URLS.away)
    const hosts = requestedUrls(requests).map((url) => new URL(url).hostname)

    return {
      passed:
        away.attributes.href === URLS.away &&
        failure !== undefined &&
        !hosts.some((host) => host === 'fonts.example.net'),
      detail: failure?.reason,
    }
  })
}

async function checkCache(reference, cacheDir) {
  await check(
    'a fresh copy with the same cache and a throwing fetch gives the same tree',
    async () => {
      const dir = fixture()
      await vendorFonts(dir, { cacheDir, fetch: throwingFetch })

      return sameTree(treeOf(dir), reference)
    },
  )

  const later = () => Date.now() + 8 * DAY_MS

  await check('8 days later and offline, the stale CSS entries give the same tree', async () => {
    const dir = fixture()
    await vendorFonts(dir, { cacheDir, fetch: throwingFetch, now: later })

    return sameTree(treeOf(dir), reference)
  })

  return later
}

async function checkRefresh(firstRequests, cacheDir, later) {
  await check(
    '8 days later and online, stylesheets are requested again and no stored font',
    async () => {
      const requests = []
      await vendorFonts(fixture(), { cacheDir, fetch: fakeFetch(requests), now: later })
      const stylesheets = (list) => new Set(requestedUrls(list).filter((url) => !isFontUrl(url)))
      const fonts = requestedUrls(requests).filter(isFontUrl)

      return {
        passed:
          isDeepStrictEqual(stylesheets(requests), stylesheets(firstRequests)) &&
          fonts.every((url) => FAILED_ANSWERS.has(url)),
        detail: `${stylesheets(requests).size} stylesheets, ${fonts.length} failed fonts again`,
      }
    },
  )
}

async function checkOffline() {
  await check(
    'offline with an empty cache: no file changes, failures reported, resolves',
    async () => {
      const dir = fixture()
      const before = treeOf(dir)
      const report = await vendorFonts(dir, { cacheDir: tempDir(), fetch: offlineFetch() })

      return {
        passed:
          sameTree(treeOf(dir), before).passed &&
          report.failures.length > 0 &&
          report.stylesheets.length === 0 &&
          report.fontFiles === 0,
        detail: `${report.failures.length} failures, ${report.failures[0]?.reason}`,
      }
    },
  )
}

async function checkSecondRun(dir, reference, cacheDir) {
  await check(
    'a second run over its own output changes nothing, requests only what failed',
    async () => {
      const requests = []
      await vendorFonts(dir, { cacheDir, fetch: fakeFetch(requests) })
      const again = requestedUrls(requests)

      return {
        passed:
          sameTree(treeOf(dir), reference).passed && again.every((url) => FAILED_ANSWERS.has(url)),
        detail: `${again.length} requests`,
      }
    },
  )
}

async function checkLegacy(cacheDir) {
  await check(
    'a 0.4 directory (no styles/, long _cssText inline) is vendored from its snapshots, its manifest unchanged',
    async () => {
      const { dir, cssText, manifest } = legacyFixture()
      await vendorFonts(dir, { cacheDir, fetch: fakeFetch([]) })
      const [style] = snapshotHead(dir, 'snapshots/a.json')
      const rewritten = style.attributes._cssText
      const names = assetNamesIn(rewritten)

      return {
        passed:
          cssText.length >= 256 &&
          names.length === 2 &&
          names.every((name) => readAsset(dir, name) !== null) &&
          hostsIn(rewritten, 'css').length === 0 &&
          !existsSync(join(dir, 'styles')) &&
          readText(dir, 'manifest.json') === manifest,
        detail: names.join(', '),
      }
    },
  )
}

try {
  await checkParseArgs()
  await checkFindRemoteUrls()

  const dir = fixture()
  const cacheDir = tempDir()
  const requests = []
  const report = await withinSeconds(30, vendorFonts(dir, { cacheDir, fetch: fakeFetch(requests) }))
  const reference = treeOf(dir)

  await checkHead(dir, requests)
  await checkSnapshot(dir)
  await checkCascade(dir)
  await checkReferences(dir)
  await checkRecount(dir)
  await checkNestedAndCycle(dir, report)
  await checkReport(report, requests)
  await checkFailures(dir, report)
  await checkRedirects(dir, report, requests)
  await checkSecondRun(dir, reference, cacheDir)
  const later = await checkCache(reference, cacheDir)
  await checkRefresh(requests, cacheDir, later)
  await checkOffline()
  await checkLegacy(cacheDir)
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-vendor-fonts: ${failures} of ${checks} checks failed`)
  process.exit(1)
}

console.log(`check-vendor-fonts: all ${checks} checks passed`)
