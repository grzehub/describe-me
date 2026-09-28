import type { CssReference } from '@describe-me/core/css-references'
import { cssReferences } from '@describe-me/core/css-references'
import { download } from './download.js'
import type { CachedResponse } from './font-cache.js'
import type { FontKind } from './font-provider.js'
import { fontProvider } from './font-provider.js'
import { mapWithConcurrency } from './map-with-concurrency.js'
import type { PendingFile, VendorContext, VendoredFile } from './vendor-font-file.js'
import { vendorFontFile } from './vendor-font-file.js'
import { vendoredName } from './vendored-name.js'

/** A vendoring run's context, with one CSS download per stylesheet URL. */
export interface StylesheetContext extends VendorContext {
  stylesheets: Map<string, Promise<StylesheetText>>
}

/**
 * The text of a stylesheet and the URL its relative references resolve
 * against, or why there is none.
 */
export type StylesheetText =
  { ok: true; css: string; finalUrl: string } | { ok: false; reason: string }

/** A target of the stylesheet: a file to vendor from `url`, or `url` to write as it is. */
interface Target {
  reference: CssReference
  vendor: FontKind | null
  url: string
}

const MAX_CSS_BYTES = 1_000_000

const MAX_IMPORT_DEPTH = 3

const FRESH_MS = 7 * 24 * 60 * 60 * 1000

const FONT_CONCURRENCY = 6

function isCss(contentType: string): boolean {
  return contentType.split(';')[0].trim().toLowerCase() === 'text/css'
}

function isUsable(cached: CachedResponse | null): cached is CachedResponse {
  return cached !== null && isCss(cached.contentType) && cached.body.byteLength <= MAX_CSS_BYTES
}

function textOf(response: { body: Uint8Array; finalUrl: string }): StylesheetText {
  return { ok: true, css: new TextDecoder().decode(response.body), finalUrl: response.finalUrl }
}

/** A fresh cache entry, else the network, else a stale entry. */
async function loadStylesheet(url: string, context: StylesheetContext): Promise<StylesheetText> {
  const cached = context.cache.read(url)
  const usable = isUsable(cached) ? cached : null

  if (usable !== null && context.now() - usable.fetchedAt < FRESH_MS) {
    return textOf(usable)
  }

  const result = await download(new URL(url), {
    kind: 'stylesheet',
    fetch: context.fetch,
    timeoutMs: context.timeoutMs,
    maxBytes: MAX_CSS_BYTES,
    unreachableHosts: context.unreachableHosts,
  })

  if (result.ok && isCss(result.contentType)) {
    const response: CachedResponse = {
      url,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      fetchedAt: context.now(),
      body: result.bytes,
    }

    context.cache.write(response)

    return textOf(response)
  }

  if (usable !== null) {
    return textOf(usable)
  }

  return {
    ok: false,
    reason: result.ok ? `served as ${result.contentType || 'no type'}` : result.reason,
  }
}

function stylesheetText(url: string, context: StylesheetContext): Promise<StylesheetText> {
  const known = context.stylesheets.get(url)
  if (known !== undefined) {
    return known
  }

  const pending = loadStylesheet(url, context)
  context.stylesheets.set(url, pending)

  return pending
}

/**
 * Where a reference goes. `data:` and `#fragment` targets stay as written.
 * Other targets are resolved, because a relative URL breaks once the file
 * moves into `assets/`.
 */
function targetOf(reference: CssReference, base: string): Target | null {
  if (reference.url.startsWith('#') || reference.url.toLowerCase().startsWith('data:')) {
    return null
  }

  if (!URL.canParse(reference.url, base)) {
    return null
  }

  const resolved = new URL(reference.url, base)
  const request = new URL(resolved)
  request.hash = ''
  if (request.protocol === 'http:') {
    request.protocol = 'https:'
  }

  const provider = fontProvider(request)
  const wanted: FontKind = reference.kind === 'import' ? 'stylesheet' : 'font'

  if (provider?.vendorable && provider.kind === wanted) {
    return { reference, vendor: wanted, url: request.href }
  }

  return { reference, vendor: null, url: resolved.href }
}

function vendorTarget(
  target: Target,
  context: StylesheetContext,
  depth: number,
): Promise<VendoredFile> {
  if (target.vendor === 'stylesheet') {
    return vendorStylesheet(target.url, context, depth + 1)
  }

  return vendorFontFile(target.url, context)
}

/** The CSS with each target replaced from the end, so earlier offsets stay valid. */
function rewrite(css: string, replacements: [CssReference, string][]): string {
  let rewritten = css

  for (const [reference, replacement] of [...replacements].reverse()) {
    rewritten = rewritten.slice(0, reference.start) + replacement + rewritten.slice(reference.end)
  }

  return rewritten
}

/**
 * One remote stylesheet with its fonts and nested imports, as bare sibling
 * names for `assets/`. It is all or nothing: when any file of the tree fails,
 * the whole stylesheet fails and none of its files is written. Imports nested
 * deeper than 3 levels fail, which also ends a cycle.
 */
export async function vendorStylesheet(
  url: string,
  context: StylesheetContext,
  depth = 0,
): Promise<VendoredFile> {
  if (depth > MAX_IMPORT_DEPTH) {
    return { ok: false, url, reason: `imports nested deeper than ${MAX_IMPORT_DEPTH} levels` }
  }

  const text = await stylesheetText(url, context)
  if (!text.ok) {
    return { ok: false, url, reason: text.reason }
  }

  const targets = cssReferences(text.css)
    .map((reference) => targetOf(reference, text.finalUrl))
    .filter((target) => target !== null)

  const vendorable = targets.filter((target) => target.vendor !== null)
  const results = await mapWithConcurrency(vendorable, FONT_CONCURRENCY, (target) => {
    return vendorTarget(target, context, depth)
  })

  const failed = results.find((result) => !result.ok)
  if (failed !== undefined) {
    return failed
  }

  const files = new Map<string, PendingFile>()
  const names = new Map<CssReference, string>()

  results.forEach((result, i) => {
    if (result.ok) {
      names.set(vendorable[i].reference, result.name)
      result.files.forEach((file, name) => files.set(name, file))
    }
  })

  const css = rewrite(
    text.css,
    targets.map((target) => [target.reference, names.get(target.reference) ?? target.url]),
  )

  const bytes = new TextEncoder().encode(css)
  const name = vendoredName(bytes, '.css')
  files.set(name, { bytes, extension: '.css' })

  return { ok: true, name, files }
}
