import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ASSET_URL_PREFIX } from '@describe-me/core/types'
import { CHROME_USER_AGENT } from './chrome-user-agent.js'
import type { TextSyntax } from './find-remote-urls.js'
import { findRemoteUrls } from './find-remote-urls.js'
import { FontCache } from './font-cache.js'
import type { FontKind } from './font-provider.js'
import { fontProvider } from './font-provider.js'
import { mapWithConcurrency } from './map-with-concurrency.js'
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

/** A text that may name remote fonts, and what a stored name is written as in it. */
interface TextFile {
  path: string
  syntax: TextSyntax
  /** The viewer resolves the asset prefix. A CSS file in `assets/` names its siblings bare. */
  prefix: string
}

type Plan =
  | { action: 'vendor'; kind: FontKind }
  | { action: 'remote'; host: string; reason: string }
  | { action: 'ignore' }

/** What the scan kept: file paths only, because snapshots can add up to hundreds of MB. */
interface Scan {
  files: TextFile[]
  head: boolean
  plans: Map<string, Plan>
}

/** The files and the budget of one run. */
interface Store {
  assetsDir: string
  files: Map<string, PendingFile>
  bytes: number
}

const TEXT_DIRECTORIES: { dir: string; extension: string; syntax: TextSyntax; prefix: string }[] = [
  { dir: 'snapshots', extension: '.json', syntax: 'json', prefix: ASSET_URL_PREFIX },
  { dir: 'styles', extension: '.css', syntax: 'css', prefix: ASSET_URL_PREFIX },
  { dir: 'assets', extension: '.css', syntax: 'css', prefix: '' },
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
  return TEXT_DIRECTORIES.flatMap(({ dir, extension, syntax, prefix }) => {
    const abs = join(dataDir, dir)
    if (!existsSync(abs)) {
      return []
    }

    return readdirSync(abs, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
      .map((entry) => entry.name)
      .sort()
      .map((name) => ({ path: join(abs, name), syntax, prefix }))
  })
}

function readManifest(dataDir: string): { head?: unknown } | null {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'))

    return typeof manifest === 'object' && manifest !== null ? manifest : null
  } catch {
    return null
  }
}

function headOf(manifest: { head?: unknown } | null): string | null {
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

  const files = textFilesIn(dataDir).filter((file) => {
    return needsVendoring(readFileSync(file.path, 'utf8'), file.syntax)
  })

  const head = headOf(readManifest(dataDir))

  return { files, head: head !== null && needsVendoring(head, 'html'), plans }
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

/** Each stored name written in place of every URL it replaces, left to right. */
function rewrite(text: string, file: Omit<TextFile, 'path'>, names: Map<string, string>): string {
  const parts: string[] = []
  let last = 0

  for (const match of findRemoteUrls(text, file.syntax)) {
    const name = names.get(match.url)
    if (name !== undefined) {
      parts.push(text.slice(last, match.start), `${file.prefix}${name}`)
      last = match.end
    }
  }

  parts.push(text.slice(last))

  return parts.join('')
}

function rewriteHead(dataDir: string, names: Map<string, string>): void {
  const manifest = readManifest(dataDir)
  const head = headOf(manifest)
  if (manifest === null || head === null) {
    return
  }

  const rewritten = rewrite(head, { syntax: 'html', prefix: ASSET_URL_PREFIX }, names)
  if (rewritten !== head) {
    manifest.head = rewritten
    writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  }
}

function rewriteTexts(dataDir: string, found: Scan, names: Map<string, string>): void {
  for (const file of found.files) {
    const text = readFileSync(file.path, 'utf8')
    const rewritten = rewrite(text, file, names)

    if (rewritten !== text) {
      writeFileSync(file.path, rewritten)
    }
  }

  if (found.head) {
    rewriteHead(dataDir, names)
  }
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
 * CSS assets at the copies. Meant for the copy inside a built site. Every file
 * is stored before any text changes, so a crash leaves only valid references.
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

  rewriteTexts(dataDir, found, names)

  const fonts = [...target.files.values()].filter((file) => file.extension !== '.css')

  return {
    stylesheets: stylesheetsPerHost(vendoredStylesheets),
    fontFiles: fonts.length,
    fontBytes: fonts.reduce((total, file) => total + file.bytes.byteLength, 0),
    leftRemote: leftRemoteOf(found.plans, budgetHosts),
    failures: failures.sort((left, right) => byText(left.url, right.url)),
  }
}
