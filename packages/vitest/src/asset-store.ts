import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { ASSET_URL_PREFIX } from '@describe-me/core/types'

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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
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
 * Content-addressed store for the project files snapshots point at (images,
 * fonts, `url()` targets of stylesheets), living in `<outDir>/assets`.
 *
 * rrweb makes most URLs absolute against the test page, whose server is gone
 * once the tests finish; a few stay root-relative, which the viewer would
 * resolve against itself. `rewrite()` copies each file it finds in the project
 * and swaps its URL for `ASSET_URL_PREFIX` plus the stored name, which the
 * viewer resolves against its own data directory.
 */
export class AssetStore {
  private readonly outDir: string
  private readonly dir: string
  private readonly root: string
  /** Stored name per URL pathname in this run, or null when it is not a project file. */
  private readonly names = new Map<string, string | null>()
  private readonly notFound = new Set<string>()
  /** Asset names per snapshot file. Snapshots are content-addressed, so an entry never goes stale. */
  private readonly referencesBySnapshot = new Map<string, string[]>()

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

  /** Root-relative paths that snapshots in this run pointed at but that do not exist. */
  missing(): string[] {
    return Array.from(this.notFound).sort()
  }

  /**
   * Drop the assets no kept snapshot refers to. Paths are relative to the
   * output directory, as the manifest stores them. Every kept file is scanned,
   * not only the ones written now: snapshots of modules that were not re-run
   * were rewritten by an earlier run.
   */
  collectGarbage(snapshotFiles: Iterable<string>): void {
    const stored = readdirSync(this.dir)
    if (stored.length === 0) {
      return
    }

    const keep = new Set<string>()
    for (const snapshotFile of snapshotFiles) {
      for (const name of this.referencesIn(snapshotFile)) {
        keep.add(name)
      }
    }

    for (const file of stored) {
      if (!keep.has(file)) {
        rmSync(join(this.dir, file), { force: true })
      }
    }
  }

  private referencesIn(snapshotFile: string): string[] {
    const cached = this.referencesBySnapshot.get(snapshotFile)
    if (cached) {
      return cached
    }

    const path = join(this.outDir, snapshotFile)
    if (!isFile(path)) {
      return []
    }

    const json = readFileSync(path, 'utf8')
    const names = Array.from(json.matchAll(ASSET_REFERENCE), (match) => match[1])
    this.referencesBySnapshot.set(snapshotFile, names)

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

    const hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 16)
    const extension = extname(file).toLowerCase()
    const name = /^\.[a-z0-9]+$/.test(extension) ? `${hash}${extension}` : hash
    const target = join(this.dir, name)

    if (!existsSync(target)) {
      copyFileSync(file, target)
    }

    return name
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
