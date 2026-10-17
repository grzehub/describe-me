/**
 * Checks how project files reach `assets/`, on the built output: the CSS
 * reference scanner of @describe-me/core, CSS files copied with their `url()`
 * and `@import` targets, the preview head, and garbage collection through CSS
 * assets. Then the machine paths in recorded data: how `ProjectPaths` writes
 * paths in error texts relative to the root, how `cleanSnapshot` drops
 * `<script>` elements and rewrites `data-vite-dev-id`, and how `missing()`
 * lists files outside the root. Every case builds its own project in a
 * temporary directory. Run after `pnpm build`.
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
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { cssReferences } from '../packages/core/dist/css-references.js'
import { AssetStore } from '../packages/vitest/dist/asset-store.js'
import { cleanSnapshot } from '../packages/vitest/dist/clean-snapshot.js'
import { ProjectPaths } from '../packages/vitest/dist/project-paths.js'

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

/**
 * How `inText` writes each line of an error, with `<repo>` a temporary
 * directory and `<root>` its `examples/web`. Each output must come back
 * unchanged from a second pass.
 */
const IN_TEXT_ROWS = [
  ['at <root>/src/Button.test.tsx:9:52', 'at src/Button.test.tsx:9:52'],
  [
    'at file://<repo>/node_modules/.pnpm/vitest@5.0.1/node_modules/vitest/dist/run.js:1628:35',
    'at node_modules/vitest/dist/run.js:1628:35',
  ],
  [
    'at runWithCancel (file://<repo>/node_modules/.pnpm/vitest@5.0.1/node_modules/vitest/dist/run.js:3314:10)',
    'at runWithCancel (node_modules/vitest/dist/run.js:3314:10)',
  ],
  [
    'at http://localhost:63315<root>/src/Button.test.tsx?import&browserv=1:13:60',
    'at src/Button.test.tsx?import&browserv=1:13:60',
  ],
  [
    'at http://localhost:63315/@fs<repo>/packages/ui/src/Card.tsx:3:1',
    'at ../../packages/ui/src/Card.tsx:3:1',
  ],
  ['test@http://localhost:63315<root>/src/Button.test.tsx:4:2', 'test@src/Button.test.tsx:4:2'],
  [
    'Failed to load /@fs<repo>/packages/ui/src/Card.tsx',
    'Failed to load ../../packages/ui/src/Card.tsx',
  ],
  ['at <repo>/examples/web-old/src/a.ts:1:1', 'at ../web-old/src/a.ts:1:1'],
  [
    'at async http://localhost:63315/node_modules/.vite/deps/react.js?v=1:10:2',
    'at async http://localhost:63315/node_modules/.vite/deps/react.js?v=1:10:2',
  ],
  ["expected '/about' to be '/home'", "expected '/about' to be '/home'"],
  ['var _jsxFileName = "<root>/src/Badge.test.tsx"', 'var _jsxFileName = "src/Badge.test.tsx"'],
  ['not found in <root>', 'not found in .'],
]

const directories = []
let checks = 0
let failures = 0

function tempDir(prefix = 'describe-me-') {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  directories.push(dir)

  return dir
}

/** `<repo>` and its `<root>`, in their real paths, as Vite names files. */
function machineProject(prefix) {
  const repo = realpathSync(tempDir(prefix))
  const root = join(repo, 'examples', 'web')
  mkdirSync(root, { recursive: true })

  return { repo, root }
}

function withPlaces(text, { repo, root }) {
  return text.replaceAll('<root>', root).replaceAll('<repo>', repo)
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

function checkInText() {
  const project = machineProject('describe-me-')
  const paths = new ProjectPaths(project.root)

  for (const [input, expected] of IN_TEXT_ROWS) {
    check(`inText: ${input} → ${expected}, and again unchanged`, () => {
      const once = paths.inText(withPlaces(input, project))
      const twice = paths.inText(once)

      return { passed: once === expected && twice === once, detail: once }
    })
  }

  check('inText through a symlink to <root> and through <root> itself', () => {
    const link = join(project.repo, 'link')
    symlinkSync(project.root, link)
    const linked = new ProjectPaths(link)
    const shown = [link, project.root].map((dir) =>
      linked.inText(`at ${dir}/src/Button.test.tsx:9:52`),
    )

    return {
      passed: shown.every((line) => line === 'at src/Button.test.tsx:9:52'),
      detail: shown.join(' | '),
    }
  })

  check('inText with a space in the name of <repo>', () => {
    const spaced = machineProject('describe me-')
    const shown = new ProjectPaths(spaced.root).inText(`at ${spaced.root}/src/Button.test.tsx:9:52`)

    return { passed: shown === 'at src/Button.test.tsx:9:52', detail: shown }
  })
}

function element(id, tagName, attributes = {}, childNodes = []) {
  return { type: 2, tagName, attributes, childNodes, id }
}

function styleWith(id, devId) {
  return element(id, 'style', { type: 'text/css', 'data-vite-dev-id': devId, _cssText: '.a {}' })
}

/** A document with scripts in the head, the body, an SVG, a shadow root and an iframe document. */
function machineSnapshot({ repo, root }) {
  const fontsource = `${repo}/node_modules/.pnpm/@fontsource+roboto@5.2.0/node_modules/@fontsource/roboto/400.css`
  const head = element(3, 'head', {}, [
    styleWith(4, `${root}/src/styles.css`),
    styleWith(5, fontsource),
    styleWith(6, `${root}/src/a.css?inline`),
    styleWith(7, `${repo}/packages/ui/src/card.css`),
    styleWith(8, 'src/styles.css'),
    styleWith(9, 'virtual:x.css'),
    element(10, 'script', { type: 'module', src: `http://localhost:63315/@fs${repo}/x.js` }),
  ])

  const shadowHost = element(14, 'div', {}, [{ ...element(15, 'script'), isShadow: true }])
  shadowHost.isShadowHost = true

  const frameDocument = {
    type: 0,
    childNodes: [element(18, 'html', {}, [element(19, 'head', {}, [element(20, 'SCRIPT')])])],
    id: 17,
  }

  const body = element(11, 'body', {}, [
    element(12, 'svg', {}, [element(13, 'script')]),
    shadowHost,
    element(16, 'iframe', {}, [frameDocument]),
    element(21, 'script', {}, [{ type: 3, textContent: 'SCRIPT_PLACEHOLDER', id: 22 }]),
  ])

  return { type: 0, childNodes: [element(2, 'html', {}, [head, body])], id: 1 }
}

function isScript(node) {
  return node.type === 2 && node.tagName.toLowerCase() === 'script'
}

/** The node and everything below it, leaving out each subtree that `skip` picks. */
function nodesOf(node, skip = () => false) {
  if (skip(node)) {
    return []
  }

  return [node, ...(node.childNodes ?? []).flatMap((child) => nodesOf(child, skip))]
}

function devIdOf(tree, id) {
  return nodesOf(tree).find((node) => node.id === id)?.attributes['data-vite-dev-id']
}

function checkCleanSnapshot() {
  const project = machineProject('describe-me-')
  const paths = new ProjectPaths(project.root)
  const snapshot = machineSnapshot(project)
  const cleaned = cleanSnapshot(JSON.stringify(snapshot), paths)
  const tree = JSON.parse(cleaned)

  const devIds = [
    [4, '<root>/src/styles.css', 'src/styles.css'],
    [
      5,
      '<repo>/node_modules/.pnpm/@fontsource+roboto@5.2.0/node_modules/@fontsource/roboto/400.css',
      'node_modules/@fontsource/roboto/400.css',
    ],
    [6, '<root>/src/a.css?inline', 'src/a.css?inline'],
    [8, 'src/styles.css', 'src/styles.css'],
    [9, 'virtual:x.css', 'virtual:x.css'],
  ]

  for (const [id, before, after] of devIds) {
    check(`cleanSnapshot: data-vite-dev-id ${before} → ${after}`, () => {
      const shown = devIdOf(tree, id)

      return { passed: shown === after, detail: shown }
    })
  }

  check('cleanSnapshot: data-vite-dev-id <repo>/packages/ui/src/card.css is left out', () => {
    const attributes = nodesOf(tree).find((node) => node.id === 7)?.attributes ?? {}

    return {
      passed: !Object.hasOwn(attributes, 'data-vite-dev-id'),
      detail: Object.keys(attributes).join(', '),
    }
  })

  check(
    'cleanSnapshot: scripts in the head, the body, an SVG, a shadow root and an iframe document are gone, other ids unchanged',
    () => {
      const kept = nodesOf(snapshot, isScript).map((node) => node.id)
      const left = nodesOf(tree).map((node) => node.id)

      return {
        passed: !nodesOf(tree).some(isScript) && sameList(left, kept),
        detail: `${left.length} nodes kept`,
      }
    },
  )

  check('cleanSnapshot: a second run gives the same text', () => {
    return cleanSnapshot(cleaned, paths) === cleaned
  })

  check(
    'cleanSnapshot: a snapshot with no script and no dev id comes back as the same string',
    () => {
      const json = '{ "type": 0, "childNodes": [], "id": 1 }'

      return cleanSnapshot(json, paths) === json
    },
  )
}

function checkMissingOutsideRoot() {
  const project = machineProject('describe-me-')
  const outDir = tempDir()
  writeFiles(project.repo, { 'shared/card.css': '.card { background: url(./gone.woff2) }' })
  const store = new AssetStore(outDir, project.root)
  const origin = 'http://localhost:63315'
  const urls = [
    `/@fs${project.repo}/shared/missing.svg`,
    `/@fs${project.repo}/node_modules/pkg/missing.svg`,
    `/@fs${project.repo}/shared/card.css`,
    `/@fs${project.root}/src/gone.png`,
  ]

  store.rewrite(JSON.stringify(urls.map((url) => ({ src: `${origin}${url}` }))), origin)
  const missing = store.missing()

  const cases = [
    [
      'a missing /@fs<repo>/shared/missing.svg is listed as ../../shared/missing.svg',
      '../../shared/missing.svg',
    ],
    [
      'a missing /@fs<repo>/node_modules/pkg/missing.svg is listed as node_modules/pkg/missing.svg',
      'node_modules/pkg/missing.svg',
    ],
    [
      'url(./gone.woff2) of a copied CSS file outside the root is listed as ../../shared/gone.woff2',
      '../../shared/gone.woff2',
    ],
    ['a missing /@fs<root>/src/gone.png is listed as /src/gone.png', '/src/gone.png'],
  ]

  for (const [name, path] of cases) {
    check(`missing(): ${name}`, () => ({
      passed: missing.includes(path),
      detail: missing.join(', '),
    }))
  }

  check('missing(): no entry starts with /@fs/', () => ({
    passed: missing.length === cases.length && !missing.some((path) => path.startsWith('/@fs/')),
    detail: missing.join(', '),
  }))
}

try {
  checkCssReferences()
  checkCssCopy()
  checkSnapshotPath()
  checkRewriteHead()
  checkGarbageCollection()
  checkInText()
  checkCleanSnapshot()
  checkMissingOutsideRoot()
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
