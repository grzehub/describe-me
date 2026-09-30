import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { Manifest } from '@describe-me/core/types'
import { ASSET_URL_PREFIX } from '@describe-me/core/types'
import { CHROME_USER_AGENT } from './chrome-user-agent.js'
import { fileNamesIn } from './file-names-in.js'
import type { TextSyntax } from './find-remote-urls.js'
import { findRemoteUrls } from './find-remote-urls.js'
import { FontCache } from './font-cache.js'
import type { FontKind } from './font-provider.js'
import { fontProvider } from './font-provider.js'
import { mapWithConcurrency } from './map-with-concurrency.js'
import { remoteStylesheets } from './remote-stylesheets.js'
import { replaceAssetNames } from './replace-asset-names.js'
import { replaceRemoteUrls } from './replace-remote-urls.js'
import type { RewrittenFiles } from './rewrite-stored-files.js'
import { rewriteStoredFiles } from './rewrite-stored-files.js'
import { storeVendoredFile } from './store-vendored-file.js'
import type { PendingFile, VendoredFile } from './vendor-font-file.js'
import { vendorFontFile } from './vendor-font-file.js'
import type { StylesheetContext } from './vendor-stylesheet.js'
import { vendorStylesheet } from './vendor-stylesheet.js'

/** How `vendorFonts` downloads. Only `cacheDir` is required. */
export interface VendorFontsOptions {
  /** Where downloads are kept between builds. */
  cacheDir: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Per request. Defaults to 10 seconds. */
  timeoutMs?: number
  /** Defaults to `Date.now`. Decides when a cached stylesheet is stale. */
  now?: () => number
}

/** What one run vendored and what stays remote. Every list is sorted. */
export interface VendorReport {
  /** Vendored stylesheets per host. */
  stylesheets: { host: string; count: number }[]
  /** Font files that the vendored stylesheets and font URLs stored in `assets/`. */
  fontFiles: number
  fontBytes: number
  /** Hosts whose fonts keep loading from the network by design, one entry per host. */
  leftRemote: { host: string; reason: string }[]
  /** URLs that did not download, as requested. They keep loading from the network. */
  failures: { url: string; reason: string }[]
}

/** A text that may name remote fonts. */
interface TextFile {
  path: string
  syntax: TextSyntax
}

type Plan =
  | { action: 'vendor'; kind: FontKind }
  | { action: 'remote'; host: string; reason: string }
  | { action: 'ignore' }

/** What the scan kept: file paths only, because snapshots can add up to hundreds of MB. */
interface Scan {
  /** Paths of the texts that name a URL to vendor. */
  kept: Set<string>
  head: boolean
  plans: Map<string, Plan>
  /** Names of the `assets/*.css` files before any download. */
  cssAssets: string[]
}

/** The fields of `manifest.json` that vendoring reads, as parsed. */
interface StoredManifest {
  head?: unknown
  remoteStylesheets?: unknown
}

/** The files and the budget of one run. */
interface Store {
  assetsDir: string
  files: Map<string, PendingFile>
  bytes: number
}

const TEXT_DIRECTORIES: { dir: string; extension: string; syntax: TextSyntax }[] = [
  { dir: 'snapshots', extension: '.json', syntax: 'json' },
  { dir: 'styles', extension: '.css', syntax: 'css' },
  { dir: 'assets', extension: '.css', syntax: 'css' },
]

/** The test server of the run, gone by now. The reporter lists what it could not copy. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const FONT_LIKE_EXTENSIONS = ['.css', '.woff2', '.woff', '.ttf', '.otf']

const NOT_ALLOWED = 'not on the font allowlist'

const BUDGET_BYTES = 100_000_000

const BUDGET_REASON = 'the 100 MB font budget is used up'

const STYLESHEET_CONCURRENCY = 6

const IGNORE: Plan = { action: 'ignore' }

function planFor(url: string): Plan {
  const parsed = new URL(url)
  const provider = fontProvider(parsed)

  if (provider?.vendorable) {
    return { action: 'vendor', kind: provider.kind }
  }

  if (provider !== null) {
    return { action: 'remote', host: parsed.hostname, reason: provider.reason }
  }

  const pathname = parsed.pathname.toLowerCase()
  if (
    LOOPBACK_HOSTS.has(parsed.hostname) ||
    !FONT_LIKE_EXTENSIONS.some((extension) => pathname.endsWith(extension))
  ) {
    return IGNORE
  }

  return { action: 'remote', host: parsed.hostname, reason: NOT_ALLOWED }
}

function textFilesIn(dataDir: string): TextFile[] {
  return TEXT_DIRECTORIES.flatMap(({ dir, extension, syntax }) => {
    const abs = join(dataDir, dir)

    return fileNamesIn(abs, extension).map((name) => ({ path: join(abs, name), syntax }))
  })
}

function readManifest(dataDir: string): StoredManifest | null {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'))

    return typeof manifest === 'object' && manifest !== null ? manifest : null
  } catch {
    return null
  }
}

function headOf(manifest: StoredManifest | null): string | null {
  return typeof manifest?.head === 'string' ? manifest.head : null
}

function scan(dataDir: string): Scan {
  const plans = new Map<string, Plan>()

  const needsVendoring = (text: string, syntax: TextSyntax): boolean => {
    let vendorable = false

    for (const { url } of findRemoteUrls(text, syntax)) {
      const plan = plans.get(url) ?? planFor(url)
      plans.set(url, plan)
      vendorable ||= plan.action === 'vendor'
    }

    return vendorable
  }

  const kept = textFilesIn(dataDir)
    .filter((file) => needsVendoring(readFileSync(file.path, 'utf8'), file.syntax))
    .map((file) => file.path)

  const head = headOf(readManifest(dataDir))

  return {
    kept: new Set(kept),
    head: head !== null && needsVendoring(head, 'html'),
    plans,
    cssAssets: fileNamesIn(join(dataDir, 'assets'), '.css'),
  }
}

type Failure = Extract<VendoredFile, { ok: false }>

/** The failure of a nested file names that file, so the reason is not lost. */
function failureOf(url: string, result: Failure): { url: string; reason: string } {
  return { url, reason: result.url === url ? result.reason : `${result.url}: ${result.reason}` }
}

async function vendorOne(
  url: string,
  kind: FontKind,
  context: StylesheetContext,
): Promise<VendoredFile> {
  try {
    if (kind === 'stylesheet') {
      return await vendorStylesheet(url, context)
    }

    return await vendorFontFile(url, context)
  } catch (error) {
    return { ok: false, url, reason: error instanceof Error ? error.message : String(error) }
  }
}

function store(target: Store, files: Map<string, PendingFile>): void {
  for (const [name, file] of files) {
    if (!target.files.has(name)) {
      storeVendoredFile(target.assetsDir, file.bytes, file.extension)
      target.files.set(name, file)
      target.bytes += file.bytes.byteLength
    }
  }
}

function nextHead(
  manifest: StoredManifest,
  found: Scan,
  names: Map<string, string>,
  rewritten: RewrittenFiles,
): unknown {
  const head = headOf(manifest)
  if (head === null || (!found.head && rewritten.assetRenames.size === 0)) {
    return manifest.head
  }

  const vendored = replaceRemoteUrls(head, 'html', ASSET_URL_PREFIX, names)

  return replaceAssetNames(vendored, rewritten.assetRenames)
}

/**
 * The hosts that frames still load stylesheets from, counted again only when a
 * snapshot, chunk or CSS asset changed. An empty or absent list stays as it is.
 */
function nextRemoteStylesheets(
  dataDir: string,
  manifest: StoredManifest,
  rewritten: RewrittenFiles,
): unknown {
  const listed = manifest.remoteStylesheets
  if (!rewritten.changed || !Array.isArray(listed) || listed.length === 0) {
    return listed
  }

  try {
    return remoteStylesheets(dataDir, manifest as Manifest)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      `describe-me: remote stylesheet hosts were not counted again (${message}). The issues menu keeps the list from the test run.`,
    )

    return listed
  }
}

/**
 * Write the head and the remote stylesheet hosts in one go, and only when one
 * of them changed. Every other field keeps its value and its place.
 */
function updateManifest(
  dataDir: string,
  found: Scan,
  names: Map<string, string>,
  rewritten: RewrittenFiles,
): void {
  const manifest = readManifest(dataDir)
  if (manifest === null) {
    return
  }

  const head = nextHead(manifest, found, names, rewritten)
  const hosts = nextRemoteStylesheets(dataDir, manifest, rewritten)
  const headChanged = head !== manifest.head
  const hostsChanged = !isDeepStrictEqual(hosts, manifest.remoteStylesheets)

  if (!headChanged && !hostsChanged) {
    return
  }

  if (headChanged) {
    manifest.head = head
  }

  if (hostsChanged) {
    manifest.remoteStylesheets = hosts
  }

  writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

/** Code-unit order, the same on every machine. */
function byText(left: string, right: string): number {
  return Number(left > right) - Number(left < right)
}

function leftRemoteOf(plans: Map<string, Plan>, budgetHosts: Set<string>) {
  const reasons = new Map<string, string>()

  for (const url of [...plans.keys()].sort()) {
    const plan = plans.get(url)
    if (plan?.action === 'remote' && !reasons.has(plan.host)) {
      reasons.set(plan.host, plan.reason)
    }
  }

  for (const host of budgetHosts) {
    if (!reasons.has(host)) {
      reasons.set(host, BUDGET_REASON)
    }
  }

  return [...reasons.keys()].sort().map((host) => ({ host, reason: reasons.get(host) ?? '' }))
}

function stylesheetsPerHost(urls: string[]): VendorReport['stylesheets'] {
  const counts = new Map<string, number>()
  for (const url of urls) {
    const host = new URL(url).hostname
    counts.set(host, (counts.get(host) ?? 0) + 1)
  }

  return [...counts.keys()].sort().map((host) => ({ host, count: counts.get(host) ?? 0 }))
}

function contextFor(options: VendorFontsOptions): StylesheetContext {
  return {
    fetch: options.fetch ?? fetch,
    timeoutMs: options.timeoutMs ?? 10_000,
    now: options.now ?? Date.now,
    cache: new FontCache(options.cacheDir, CHROME_USER_AGENT),
    unreachableHosts: new Map(),
    fonts: new Map(),
    stylesheets: new Map(),
  }
}

/**
 * Download the web fonts that a data directory loads from known font hosts
 * into its `assets/`, and point the manifest head, snapshots, style chunks and
 * CSS assets at the copies. Meant for the copy inside a built site. A style
 * chunk or CSS asset whose text changes moves to the hash of its new text, and
 * the manifest's `remoteStylesheets` is counted again. Every file is stored
 * before any text that names it changes, and replaced files are removed last,
 * so a crash leaves only valid references.
 */
export async function vendorFonts(
  dataDir: string,
  options: VendorFontsOptions,
): Promise<VendorReport> {
  const found = scan(dataDir)
  const context = contextFor(options)
  const target: Store = { assetsDir: join(dataDir, 'assets'), files: new Map(), bytes: 0 }
  const names = new Map<string, string>()
  const vendoredStylesheets: string[] = []
  const failures: { url: string; reason: string }[] = []
  const budgetHosts = new Set<string>()

  const vendorable = [...found.plans]
    .flatMap(([url, plan]) => (plan.action === 'vendor' ? [{ url, kind: plan.kind }] : []))
    .sort((left, right) => byText(left.url, right.url))

  await mapWithConcurrency(vendorable, STYLESHEET_CONCURRENCY, async ({ url, kind }) => {
    if (target.bytes >= BUDGET_BYTES) {
      budgetHosts.add(new URL(url).hostname)
      return
    }

    const result = await vendorOne(url, kind, context)
    if (!result.ok) {
      failures.push(failureOf(url, result))
      return
    }

    store(target, result.files)
    names.set(url, result.name)
    if (kind === 'stylesheet') {
      vendoredStylesheets.push(url)
    }
  })

  const rewritten = rewriteStoredFiles(dataDir, {
    names,
    cssAssets: found.cssAssets,
    kept: found.kept,
    vendored: new Set(target.files.keys()),
  })

  updateManifest(dataDir, found, names, rewritten)

  for (const path of rewritten.replaced) {
    rmSync(path, { force: true })
  }

  const fonts = [...target.files.values()].filter((file) => file.extension !== '.css')

  return {
    stylesheets: stylesheetsPerHost(vendoredStylesheets),
    fontFiles: fonts.length,
    fontBytes: fonts.reduce((total, file) => total + file.bytes.byteLength, 0),
    leftRemote: leftRemoteOf(found.plans, budgetHosts),
    failures: failures.sort((left, right) => byText(left.url, right.url)),
  }
}
