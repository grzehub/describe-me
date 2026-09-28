/**
 * Checks how project files reach `assets/`, on the built output: the CSS
 * reference scanner of @describe-me/core, CSS files copied with their `url()`
 * and `@import` targets, the preview head, and garbage collection through CSS
 * assets. Every case builds its own project in a temporary directory. Run
 * after `pnpm build`.
 *
 * Usage: `node scripts/check-asset-store.mjs`
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { cssReferences } from '../packages/core/dist/css-references.js'
import { AssetStore } from '../packages/vitest/dist/asset-store.js'

const ASSET_URL = /describe-me-asset:([0-9a-f]{16}(?:\.[a-z0-9]+)?)/
const ASSET_NAME = /^[0-9a-f]{16}(?:\.[a-z0-9]+)?$/

const GOOGLE_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap'

const CSS_SAMPLES = {
  google: `@import url(${GOOGLE_CSS});`,
  forms: [
    '@import "a.css";',
    "@import 'b.css' screen;",
    '.x { background: url( "x.png" ) }',
    ".y { background: url('y.png') }",
    '.z { background: URL(z.png) }',
  ].join('\n'),
  fontFace: "@font-face { src: local(Inter), url(i.woff2) format('woff2') }",
  data: '.d { background: url(data:image/png;base64,iVBORw0KGgo=) }',
  skipped: '/* url(comment.png) */ .c::before { content: "url(no.png)" }',
}

/** A project whose `fonts/fonts.css` exercises every kind of target. */
const FONTS_PROJECT = {
  'fonts/fonts.css': [
    '@import "./nested.css";',
    `@import url(${GOOGLE_CSS});`,
    "@import 'cycle-a.css';",
    '@font-face {',
    "  font-family: 'Inter';",
    "  src: url(./inter.woff2) format('woff2'), url(\"/root.woff2?v=3\") format('woff2');",
    '}',
    ".icon { background: url('icons.svg#star'); }",
    '.remote { background: url(https://example.com/bg.png); }',
    '.inline { background: url(data:image/png;base64,iVBORw0KGgo=); }',
    '.secret { background: url(../secret.env); }',
    ".gone { background: url('./gone.woff2'); }",
  ].join('\n'),
  'fonts/nested.css': '.nested { background: url(./nested.png); }',
  'fonts/nested.png': 'nested png',
  'fonts/inter.woff2': 'inter woff2',
  'fonts/icons.svg': '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="star"/></svg>',
  'fonts/cycle-a.css': '@import "cycle-b.css";\n.a { background: url(a.png); }',
  'fonts/cycle-b.css': '@import "cycle-a.css";\n.b { color: red; }',
  'fonts/a.png': 'a png',
  'public/root.woff2': 'root woff2',
  'secret.env': 'TOKEN=do-not-publish',
}

/** A project for the preview head's own URLs. */
const HEAD_PROJECT = {
  'site.css': 'body { margin: 0; }',
  'public/icon.png': 'icon png',
  'bg.png': 'bg png',
  'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
}

const directories = []
let checks = 0
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
  checks++
  if (!passed) {
    failures++
  }

  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${name}${suffix}`)
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, i) => value === right[i])
}

function contentHash(content) {
  return createHash('sha1').update(content).digest('hex').slice(0, 16)
}

/** The name the asset store gives a file it copies byte for byte. */
function storedName(content, extension) {
  return `${contentHash(content)}${extension}`
}

function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
}

function readAsset(outDir, name) {
  const file = join(outDir, 'assets', name)

  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function hasAsset(outDir, name) {
  return existsSync(join(outDir, 'assets', name))
}

function urlsIn(css) {
  return cssReferences(css).map((reference) => reference.url)
}

function describeReferences(references) {
  return references.map((reference) => `${reference.kind} ${reference.url}`).join(', ')
}

/** The stored CSS asset that one of `urls` names and whose text includes `marker`. */
function importedAsset(outDir, urls, marker) {
  const name = urls.find((url) => ASSET_NAME.test(url) && readAsset(outDir, url).includes(marker))

  return { name, css: name ? readAsset(outDir, name) : '' }
}

/** Every stored asset the text names, following the sibling names inside CSS assets. */
function reachableFrom(outDir, text) {
  const reached = new Set()
  const pending = [text.match(ASSET_URL)?.[1]].filter(Boolean)

  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (reached.has(name) || !hasAsset(outDir, name)) {
      continue
    }

    reached.add(name)
    if (name.endsWith('.css')) {
      const siblings = urlsIn(readAsset(outDir, name)).map((url) => url.split(/[?#]/)[0])
      pending.push(...siblings.filter((url) => ASSET_NAME.test(url)))
    }
  }

  return reached
}

function copyFontsProject() {
  const root = tempDir()
  const outDir = tempDir()
  writeFiles(root, FONTS_PROJECT)
  const store = new AssetStore(outDir, root)
  const head = store.rewriteHead('<link rel="stylesheet" href="/fonts/fonts.css">')
  const fontsName = head.match(ASSET_URL)?.[1]
  const fonts = fontsName ? readAsset(outDir, fontsName) : ''

  return { outDir, store, head, fontsName, fonts, urls: urlsIn(fonts) }
}

function checkCssReferences() {
  check('cssReferences reads an unquoted Google Fonts @import url() whole, as one import', () => {
    const references = cssReferences(CSS_SAMPLES.google)
    const [first] = references

    return {
      passed: references.length === 1 && first.kind === 'import' && first.url === GOOGLE_CSS,
      detail: describeReferences(references),
    }
  })

  check('cssReferences finds @import strings, url() with spaces or quotes, and URL()', () => {
    const found = describeReferences(cssReferences(CSS_SAMPLES.forms))
    const expected = 'import a.css, import b.css, url x.png, url y.png, url z.png'

    return { passed: found === expected, detail: found }
  })

  check(
    "cssReferences yields only i.woff2 from src: local(Inter), url(i.woff2) format('woff2')",
    () => {
      const urls = urlsIn(CSS_SAMPLES.fontFace)

      return { passed: sameList(urls, ['i.woff2']), detail: urls.join(', ') }
    },
  )

  check('cssReferences returns a data: URL', () => {
    const urls = urlsIn(CSS_SAMPLES.data)

    return { passed: sameList(urls, ['data:image/png;base64,iVBORw0KGgo=']), detail: urls[0] }
  })

  check('cssReferences finds nothing in a comment or in content: "url(no.png)"', () => {
    const urls = urlsIn(CSS_SAMPLES.skipped)

    return { passed: urls.length === 0, detail: `${urls.length} found` }
  })

  check('cssReferences: slice(start, end) === url for every hit', () => {
    const texts = [...Object.values(CSS_SAMPLES), FONTS_PROJECT['fonts/fonts.css']]
    const hits = texts.flatMap((css) => cssReferences(css).map((reference) => ({ css, reference })))
    const wrong = hits.filter(({ css, reference }) => {
      return css.slice(reference.start, reference.end) !== reference.url
    })

    return { passed: hits.length > 10 && wrong.length === 0, detail: `${hits.length} hits` }
  })
}

function checkCssCopy() {
  const { outDir, store, head, fontsName, fonts, urls } = copyFontsProject()

  check('rewriteHead links the stored copy of fonts.css', () => ({
    passed: head === `<link rel="stylesheet" href="describe-me-asset:${fontsName}">`,
    detail: head,
  }))

  check('relative, root-relative and #fragment targets become sibling names', () => {
    const inter = storedName('inter woff2', '.woff2')
    const root = storedName('root woff2', '.woff2')
    const icons = storedName(FONTS_PROJECT['fonts/icons.svg'], '.svg')
    const written = [`url(${inter})`, `url("${root}")`, `url('${icons}#star')`]

    return {
      passed:
        written.every((url) => fonts.includes(url)) &&
        [inter, root, icons].every((name) => hasAsset(outDir, name)),
      detail: written.join(' '),
    }
  })

  check('a nested @import is copied and rewritten', () => {
    const nested = importedAsset(outDir, urls, '.nested')
    const png = storedName('nested png', '.png')

    return {
      passed:
        fonts.startsWith(`@import "${nested.name}";`) &&
        nested.css === `.nested { background: url(${png}); }` &&
        hasAsset(outDir, png),
      detail: nested.css,
    }
  })

  check('remote and data: URLs are unchanged', () => {
    const kept = [GOOGLE_CSS, 'https://example.com/bg.png', 'data:image/png;base64,iVBORw0KGgo=']

    return kept.every((url) => urls.includes(url))
  })

  check('url(../secret.env) stays as written and is not copied, although the file exists', () => {
    const stored = readdirSync(join(outDir, 'assets'))
    const copied = stored.some((name) => readAsset(outDir, name).includes('do-not-publish'))

    return {
      passed:
        fonts.includes('url(../secret.env)') &&
        !copied &&
        !store.missing().some((path) => path.includes('secret')),
      detail: `${stored.length} assets`,
    }
  })

  check('a missing ./gone.woff2 is listed by missing()', () => {
    const missing = store.missing()

    return {
      passed: sameList(missing, ['/fonts/gone.woff2']) && fonts.includes("url('./gone.woff2')"),
      detail: missing.join(', '),
    }
  })

  check('an a.css ⇄ b.css @import cycle ends, the reference back stays as written', () => {
    const cycleA = importedAsset(outDir, urls, '.a {')
    const cycleB = importedAsset(outDir, urlsIn(cycleA.css), '.b {')

    return {
      passed: cycleB.css.startsWith('@import "cycle-a.css";'),
      detail: cycleB.css.split('\n')[0],
    }
  })

  check('each stored CSS file is named by the sha1-16 of its content', () => {
    const cssNames = readdirSync(join(outDir, 'assets')).filter((name) => name.endsWith('.css'))
    const misnamed = cssNames.filter((name) => name !== storedName(readAsset(outDir, name), '.css'))

    return {
      passed: cssNames.length === 4 && misnamed.length === 0,
      detail: `${cssNames.length} CSS files`,
    }
  })
}

function checkSnapshotPath() {
  check('rewrite() stores a linked project stylesheet with its url()s rewritten', () => {
    const root = tempDir()
    const outDir = tempDir()
    writeFiles(root, FONTS_PROJECT)
    const store = new AssetStore(outDir, root)
    const json =
      '{"type":2,"tagName":"link","attributes":{"rel":"stylesheet","href":"http://localhost:3000/fonts/fonts.css"},"childNodes":[],"id":7}'

    const rewritten = store.rewrite(json, 'http://localhost:3000')
    const name = rewritten.match(ASSET_URL)?.[1]
    const css = name ? readAsset(outDir, name) : ''
    const inter = storedName('inter woff2', '.woff2')

    return {
      passed:
        rewritten.includes(`"href":"describe-me-asset:${name}"`) &&
        name.endsWith('.css') &&
        css.includes(`url(${inter})`) &&
        hasAsset(outDir, inter),
      detail: rewritten.match(/"href":"[^"]*"/)?.[0],
    }
  })
}

function checkRewriteHead() {
  const root = tempDir()
  const outDir = tempDir()
  writeFiles(root, HEAD_PROJECT)
  const store = new AssetStore(outDir, root)
  const site = storedName(HEAD_PROJECT['site.css'], '.css')
  const icon = storedName('icon png', '.png')
  const background = storedName('bg png', '.png')
  const logo = storedName(HEAD_PROJECT['logo.svg'], '.svg')

  check('rewriteHead rewrites double-quoted, single-quoted and bare href, and <img src>', () => {
    const html = [
      '<link rel="stylesheet" href="/site.css">',
      "<link rel='icon' href='/icon.png'>",
      '<link rel=preload href=/bg.png as=image>',
      '<img src="logo.svg" alt="">',
    ].join('\n')

    const expected = [
      `<link rel="stylesheet" href="describe-me-asset:${site}">`,
      `<link rel='icon' href='describe-me-asset:${icon}'>`,
      `<link rel=preload href=describe-me-asset:${background} as=image>`,
      `<img src="describe-me-asset:${logo}" alt="">`,
    ].join('\n')

    const rewritten = store.rewriteHead(html)

    return { passed: rewritten === expected, detail: rewritten.replaceAll('\n', ' ') }
  })

  check('rewriteHead leaves http:, https:, //, data:, #, mailto: and data-src alone', () => {
    const html = [
      '<link rel="stylesheet" href="http://example.com/a.css">',
      '<link rel="stylesheet" href="https://example.com/b.css">',
      '<link rel="stylesheet" href="//cdn.example.com/c.css">',
      '<link rel="stylesheet" href="data:text/css,body{color:red}">',
      '<a href="#top">top</a>',
      '<a href="mailto:someone@example.com">mail</a>',
      '<img data-src="/logo.svg" alt="">',
    ].join('\n')

    return store.rewriteHead(html) === html
  })

  check('rewriteHead rewrites a <style> body and a style attribute', () => {
    const html = `<style>body { background: url(/bg.png) }</style><div style="background: url('/bg.png')"></div>`
    const expected = `<style>body { background: url(describe-me-asset:${background}) }</style><div style="background: url('describe-me-asset:${background}')"></div>`
    const rewritten = store.rewriteHead(html)

    return { passed: rewritten === expected, detail: rewritten }
  })

  check(
    'rewriteHead leaves comments and <script> elements as written, also with loose ends',
    () => {
      const html = [
        '<!-- <link rel="stylesheet" href="/site.css"> -->',
        '<!-- <img src="/bg.png"> --!>',
        '<script src="/bg.png">const src = "/bg.png"</script foo>',
        '<link rel="icon" href="/icon.png">',
      ].join('\n')

      const expected = html.replace('href="/icon.png"', `href="describe-me-asset:${icon}"`)
      const rewritten = store.rewriteHead(html)

      return { passed: rewritten === expected, detail: rewritten.replaceAll('\n', ' ') }
    },
  )

  check('rewriteHead resolves ./ and ../ from the project root and lists missing files', () => {
    const html = '<link rel="stylesheet" href="./site.css"><link href="../gone.css">'
    const rewritten = store.rewriteHead(html)
    const expected = `<link rel="stylesheet" href="describe-me-asset:${site}"><link href="../gone.css">`

    return {
      passed: rewritten === expected && store.missing().includes('/gone.css'),
      detail: store.missing().join(', '),
    }
  })
}

function checkGarbageCollection() {
  check(
    'collectGarbage([], [head]) keeps what the head reaches through CSS, drops the rest',
    () => {
      const { outDir, store, head } = copyFontsProject()
      const assets = join(outDir, 'assets')
      const before = readdirSync(assets).sort()
      writeFileSync(join(assets, 'ffffffffffffffff.png'), 'referenced from nothing')

      const reachable = [...reachableFrom(outDir, head)].sort()
      store.collectGarbage([], [head])
      const left = readdirSync(assets).sort()

      return {
        passed: before.length === 9 && sameList(left, before) && sameList(left, reachable),
        detail: `${left.length} of ${before.length + 1} kept`,
      }
    },
  )
}

try {
  checkCssReferences()
  checkCssCopy()
  checkSnapshotPath()
  checkRewriteHead()
  checkGarbageCollection()
} finally {
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`check-asset-store: ${failures} of ${checks} checks failed`)
  process.exit(1)
}

console.log(`check-asset-store: all ${checks} checks passed`)
