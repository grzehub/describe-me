import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { ASSET_URL_PREFIX } from '@describe-me/core/types'
import { collectableFiles } from './collectable-files.js'
import { cssAssetReferences } from './css-asset-references.js'
import { rewriteCssReferences } from './rewrite-css-references.js'
import { rewriteHeadReferences } from './rewrite-head-references.js'

/** A URL path inside serialized JSON runs until a quote, whitespace, `)`, `\`, `<` or `>`. */
const URL_PATH = String.raw`/[^"'\s)\\<>]*`

/** A root-relative path: one slash, not the two of a protocol-relative URL. */
const ROOT_RELATIVE_PATH = String.raw`/(?!/)[^"'\s)\\<>]*`

/**
 * `url(/…)` in CSS text, with the opening quote as it looks inside JSON (`\"`,
 * `'` or none). rrweb makes stylesheet URLs absolute through the sheet's
 * `ownerNode`, which jsdom does not implement, so in jsdom they stay as Vite
 * wrote them.
 */
const CSS_ROOT_RELATIVE_URL = new RegExp(String.raw`url\((\\"|')?(${ROOT_RELATIVE_PATH})`, 'g')

/** rrweb makes `src` and `href` absolute, but leaves a video's `poster` as authored. */
const ROOT_RELATIVE_POSTER = new RegExp(`"poster":"(${ROOT_RELATIVE_PATH})`, 'g')

/** A stored asset's name: a content hash and, when the file has one, its extension. */
const ASSET_REFERENCE = new RegExp(
  `${escapeRegExp(ASSET_URL_PREFIX)}([0-9a-f]{16}(?:\\.[a-z0-9]+)?)`,
  'g',
)

/**
 * Dev-server paths that are never project files: Vite's client and module ids,
 * the pre-bundled dependencies, and the pages Vitest serves in browser mode.
 */
const SERVER_PREFIXES = [
  '/@vite/',
  '/@id/',
  '/@react-refresh',
  '/node_modules/.vite/',
  '/__vitest__/',
  '/__vitest_browser__/',
  '/__vitest_test__/',
]

/** Scripts, not assets: they never run in the viewer, so their URLs are left as they are. */
const MODULE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.vue',
  '.svelte',
])

/** A URL with a scheme (`https:`, `data:`, `mailto:`, `describe-me-asset:`) is never a project path. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** The preview head's URLs resolve as if the page were served from the project root. */
const PROJECT_ROOT_URL = 'http://project-root.invalid/'

/**
 * What a copied CSS file may pull into the store: stylesheets, fonts, images
 * and cursors. Any other target stays as written, so a stylesheet cannot
 * publish source files or secrets.
 */
const CSS_TARGET_EXTENSIONS = new Set([
  '.css',
  '.woff2',
  '.woff',
  '.ttf',
  '.otf',
  '.eot',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.bmp',
  '.cur',
])

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

function contentHash(content: string | Buffer): string {
  return createHash('sha1').update(content).digest('hex').slice(0, 16)
}

function assetNamesIn(text: string): string[] {
  return Array.from(text.matchAll(ASSET_REFERENCE), (match) => match[1])
}

/** Empty values, `#fragment`s, protocol-relative and scheme URLs never name a project file. */
function isExternalUrl(url: string): boolean {
  return url === '' || url.startsWith('#') || url.startsWith('//') || URL_SCHEME.test(url)
}

/**
 * A preview head URL as a root-relative path, or null when it cannot be read
 * or leaves the project root, as `\\host\x` does.
 */
function rootRelativePath(url: string): string | null {
  let resolved: URL
  try {
    resolved = new URL(url, PROJECT_ROOT_URL)
  } catch {
    return null
  }

  if (!resolved.href.startsWith(PROJECT_ROOT_URL)) {
    return null
  }

  return resolved.pathname + resolved.search + resolved.hash
}

function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

/** Split `/logo.svg?v=2#icon` into its pathname and its fragment; the query is dropped. */
function splitUrlPath(urlPath: string): { pathname: string; fragment: string } {
  const hashAt = urlPath.indexOf('#')
  const beforeHash = hashAt === -1 ? urlPath : urlPath.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : urlPath.slice(hashAt)
  const queryAt = beforeHash.indexOf('?')
  const pathname = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt)

  return { pathname, fragment }
}

function isServerPath(pathname: string): boolean {
  if (SERVER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  return MODULE_EXTENSIONS.has(extname(pathname).toLowerCase())
}

/** Vite serves files outside the root as `/@fs/<absolute path>`; a Windows path keeps its drive letter. */
function fsPathFromUrl(pathname: string): string {
  const path = pathname.slice('/@fs/'.length)

  return /^[A-Za-z]:/.test(path) ? path : `/${path}`
}

/**
 * Content-addressed store for the project files that snapshots and the preview
 * head point at (images, fonts, `url()` targets of stylesheets), living in
 * `<outDir>/assets`.
 *
 * rrweb makes most URLs absolute against the test page, whose server is gone
 * once the tests finish. A few stay root-relative, which the viewer would
 * resolve against itself. `rewrite()` copies each file it finds in the project
 * and swaps its URL for `ASSET_URL_PREFIX` plus the stored name, which the
 * viewer resolves against its own data directory. `rewriteHead()` does the
 * same for the preview head. A CSS file is stored with its own `url()` and
 * `@import` targets copied too and written as bare sibling names, so it keeps
 * working from `assets/`.
 */
export class AssetStore {
  private readonly outDir: string
  private readonly dir: string
  private readonly root: string
  /** Stored name per URL pathname in this run, or null when it is not a project file. */
  private readonly names = new Map<string, string | null>()
  private readonly notFound = new Set<string>()
  /** Stored name per absolute CSS file path in this run. */
  private readonly cssNames = new Map<string, string>()
  /** CSS files being copied right now, so an `@import` cycle ends. */
  private readonly copying = new Set<string>()
  /**
   * Asset names per snapshot or style chunk. Both are content-addressed, so an
   * entry never goes stale.
   */
  private readonly referencesByFile = new Map<string, string[]>()
  /** Asset names per stored CSS asset, which is content-addressed too. */
  private readonly referencesByCssAsset = new Map<string, string[]>()

  constructor(outDir: string, root: string) {
    this.outDir = outDir
    this.dir = join(outDir, 'assets')
    this.root = resolve(root)
    mkdirSync(this.dir, { recursive: true })
  }

  /** Forget what the previous run found: files may have changed or appeared since. */
  startRun(): void {
    this.names.clear()
    this.notFound.clear()
    this.cssNames.clear()
  }

  /**
   * Replace every URL in a serialized snapshot that points at a project file
   * with an asset URL. rrweb has made most of them absolute against `origin`:
   * `src`, `href`, `srcset`, `xlink:href`, `style` attributes and, in a real
   * browser, `url()` inside stylesheets. The two it leaves root-relative are
   * handled on their own. A `#fragment` is kept, for SVG sprites.
   */
  rewrite(json: string, origin: string | undefined): string {
    let rewritten = json

    // An opaque origin serializes as "null", which is not a URL prefix at all.
    if (origin !== undefined && /^https?:\/\//.test(origin)) {
      const onOrigin = new RegExp(`${escapeRegExp(origin)}(${URL_PATH})`, 'g')

      rewritten = rewritten.replace(onOrigin, (url: string, urlPath: string) => {
        return this.assetUrl(urlPath) ?? url
      })
    }

    rewritten = rewritten.replace(
      CSS_ROOT_RELATIVE_URL,
      (url: string, quote: string | undefined, urlPath: string) => {
        const asset = this.assetUrl(urlPath)

        return asset === null ? url : `url(${quote ?? ''}${asset}`
      },
    )

    return rewritten.replace(ROOT_RELATIVE_POSTER, (poster: string, urlPath: string) => {
      const asset = this.assetUrl(urlPath)

      return asset === null ? poster : `"poster":"${asset}`
    })
  }

  /**
   * Replace every URL in the preview head that points at a project file with
   * an asset URL. A relative URL counts from the project root, the page the
   * head is written for.
   */
  rewriteHead(html: string): string {
    return rewriteHeadReferences(html, (url) => {
      if (isExternalUrl(url)) {
        return null
      }

      const path = rootRelativePath(url)

      return path === null ? null : this.assetUrl(path)
    })
  }

  /**
   * Paths that snapshots, the preview head or copied CSS files in this run
   * pointed at but that do not exist: root-relative inside the project root,
   * `/@fs/<absolute path>` outside it.
   */
  missing(): string[] {
    return Array.from(this.notFound).sort()
  }

  /**
   * Drop the assets that no kept snapshot or style chunk, no inline text such
   * as the preview head, and no kept CSS asset refers to. Paths are relative
   * to the output directory, as the manifest stores them. Every kept file is
   * scanned, not only the ones written now: snapshots of modules that were not
   * re-run were rewritten by an earlier run.
   */
  collectGarbage(files: Iterable<string>, inlineTexts: Iterable<string> = []): void {
    const stored = collectableFiles(this.dir)
    if (stored.length === 0) {
      return
    }

    const keep = new Set<string>()
    for (const file of files) {
      for (const name of this.referencesIn(file)) {
        keep.add(name)
      }
    }

    for (const text of inlineTexts) {
      for (const name of assetNamesIn(text)) {
        keep.add(name)
      }
    }

    this.keepCssTargets(keep)

    for (const file of stored) {
      if (!keep.has(file)) {
        rmSync(join(this.dir, file), { force: true })
      }
    }
  }

  /** Add what each kept CSS asset refers to, and what those refer to in turn. */
  private keepCssTargets(keep: Set<string>): void {
    const pending = Array.from(keep).filter((name) => name.endsWith('.css'))
    let name = pending.pop()

    while (name !== undefined) {
      for (const target of this.cssAssetReferencesOf(name)) {
        if (!keep.has(target)) {
          keep.add(target)
          pending.push(target)
        }
      }

      name = pending.pop()
    }
  }

  private cssAssetReferencesOf(name: string): string[] {
    const cached = this.referencesByCssAsset.get(name)
    if (cached) {
      return cached
    }

    const path = join(this.dir, name)
    if (!name.endsWith('.css') || !isFile(path)) {
      return []
    }

    const names = cssAssetReferences(readFileSync(path, 'utf8'))
    this.referencesByCssAsset.set(name, names)

    return names
  }

  private referencesIn(file: string): string[] {
    const cached = this.referencesByFile.get(file)
    if (cached) {
      return cached
    }

    const path = join(this.outDir, file)
    if (!isFile(path)) {
      return []
    }

    const names = assetNamesIn(readFileSync(path, 'utf8'))
    this.referencesByFile.set(file, names)

    return names
  }

  /** The asset URL for a root-relative URL path, or null when it is not a project file. */
  private assetUrl(urlPath: string): string | null {
    const { pathname, fragment } = splitUrlPath(urlPath)
    const name = this.nameFor(pathname)

    if (name === null) {
      return null
    }

    return `${ASSET_URL_PREFIX}${name}${fragment}`
  }

  /** The stored name for a URL pathname, copying the file on first sight in this run. */
  private nameFor(pathname: string): string | null {
    const known = this.names.get(pathname)
    if (known !== undefined) {
      return known
    }

    const name = this.copyIntoStore(decodePath(pathname))
    this.names.set(pathname, name)

    return name
  }

  private copyIntoStore(pathname: string): string | null {
    if (isServerPath(pathname)) {
      return null
    }

    const file = this.fileFor(pathname)

    // Page links such as `/`, `/#` or `/about` resolve to nothing and are not
    // assets either. Only a path that names a file is worth reporting.
    if (!file) {
      if (extname(pathname) !== '') {
        this.notFound.add(pathname)
      }

      return null
    }

    return this.store(file)
  }

  /** Store a project file under its content hash, and return its stored name. */
  private store(file: string): string {
    const extension = extname(file).toLowerCase()
    if (extension === '.css') {
      return this.storeCss(file)
    }

    const hash = contentHash(readFileSync(file))
    const name = /^\.[a-z0-9]+$/.test(extension) ? `${hash}${extension}` : hash
    const target = join(this.dir, name)

    if (!existsSync(target)) {
      copyFileSync(file, target)
    }

    return name
  }

  /**
   * Store a CSS file with its `url()` and `@import` targets stored too. They
   * are written as bare sibling names, which the browser resolves against the
   * stylesheet's own URL, so the viewer has nothing to substitute. The name is
   * the hash of the rewritten text.
   */
  private storeCss(file: string): string {
    const known = this.cssNames.get(file)
    if (known !== undefined) {
      return known
    }

    let css: string
    this.copying.add(file)

    try {
      css = rewriteCssReferences(readFileSync(file, 'utf8'), (url) => this.siblingName(url, file))
    } finally {
      this.copying.delete(file)
    }

    const name = `${contentHash(css)}.css`
    const target = join(this.dir, name)

    if (!existsSync(target)) {
      writeFileSync(target, css)
    }

    this.cssNames.set(file, name)

    return name
  }

  /**
   * The stored name, with its fragment, for a target of the CSS file
   * `cssFile`, or null to leave the target as written: a remote URL, a
   * file type outside the allowlist, a missing file or a file being copied.
   */
  private siblingName(url: string, cssFile: string): string | null {
    if (isExternalUrl(url)) {
      return null
    }

    const { pathname, fragment } = splitUrlPath(url)
    const path = decodePath(pathname)

    if (!CSS_TARGET_EXTENSIONS.has(extname(path).toLowerCase())) {
      return null
    }

    const file = this.cssTargetFile(path, cssFile)

    if (!file || this.copying.has(file)) {
      return null
    }

    return `${this.store(file)}${fragment}`
  }

  /**
   * The file behind a target path of a CSS file, reported when missing. A
   * root-relative path is looked up like a snapshot URL, a relative one next
   * to the CSS file on disk.
   */
  private cssTargetFile(path: string, cssFile: string): string | undefined {
    if (path.startsWith('/')) {
      const file = this.fileFor(path)
      if (!file) {
        this.notFound.add(path)
      }

      return file
    }

    const file = resolve(dirname(cssFile), path)
    if (!isFile(file)) {
      this.notFound.add(this.servedPath(file))
      return undefined
    }

    return file
  }

  /** How Vite serves a file: root-relative inside the project root, `/@fs/<absolute path>` outside it. */
  private servedPath(file: string): string {
    const path = file.startsWith(this.root + sep)
      ? file.slice(this.root.length)
      : `/@fs/${file.replace(/^[\\/]/, '')}`

    return path.split(sep).join('/')
  }

  /** Where Vite serves a URL pathname from: `/@fs/`, the project root, or its `public/` folder. */
  private fileFor(pathname: string): string | undefined {
    if (pathname.startsWith('/@fs/')) {
      const path = fsPathFromUrl(pathname)

      return isFile(path) ? path : undefined
    }

    const candidates = [
      resolve(this.root, `.${pathname}`),
      resolve(this.root, 'public', `.${pathname}`),
    ]

    // A decoded `%2F..` must not reach outside the project.
    return candidates.find((path) => path.startsWith(this.root + sep) && isFile(path))
  }
}
