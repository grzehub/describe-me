import { download } from './download.js'
import type { FontCache } from './font-cache.js'
import { fontExtension } from './font-extension.js'
import { vendoredName } from './vendored-name.js'

/** What the downloads of one vendoring run share. */
export interface VendorContext {
  fetch: typeof fetch
  timeoutMs: number
  now: () => number
  cache: FontCache
  /** Hosts that failed on the network in this run, with the reason. */
  unreachableHosts: Map<string, string>
  /** One download per font URL and run. */
  fonts: Map<string, Promise<VendoredFile>>
}

/** Downloaded bytes, held in memory until the stylesheet that needs them has succeeded. */
export interface PendingFile {
  bytes: Uint8Array
  extension: string
}

/** A file ready for `assets/` under `name`, with every file it needs, or why it is not. */
export type VendoredFile =
  | { ok: true; name: string; files: Map<string, PendingFile> }
  | { ok: false; url: string; reason: string }

const MAX_FONT_BYTES = 10_000_000

function vendored(bytes: Uint8Array, extension: string): VendoredFile {
  const name = vendoredName(bytes, extension)

  return { ok: true, name, files: new Map([[name, { bytes, extension }]]) }
}

async function downloadFont(url: string, context: VendorContext): Promise<VendoredFile> {
  const cached = context.cache.read(url)
  const cachedExtension = cached === null ? null : fontExtension(cached.body)

  if (cached !== null && cachedExtension !== null) {
    return vendored(cached.body, cachedExtension)
  }

  const result = await download(new URL(url), {
    kind: 'font',
    fetch: context.fetch,
    timeoutMs: context.timeoutMs,
    maxBytes: MAX_FONT_BYTES,
    unreachableHosts: context.unreachableHosts,
  })

  if (!result.ok) {
    return { ok: false, url, reason: result.reason }
  }

  const extension = fontExtension(result.bytes)
  if (extension === null) {
    return { ok: false, url, reason: 'not a font file' }
  }

  context.cache.write({
    url,
    finalUrl: result.finalUrl,
    contentType: result.contentType,
    fetchedAt: context.now(),
    body: result.bytes,
  })

  return vendored(result.bytes, extension)
}

/**
 * One font file from an allowlisted host, from the cache or the network. The
 * extension comes from the file's signature, because URLs such as Google's
 * `/l/font?kit=…` have none. Cached fonts never expire.
 */
export function vendorFontFile(url: string, context: VendorContext): Promise<VendoredFile> {
  const known = context.fonts.get(url)
  if (known !== undefined) {
    return known
  }

  const pending = downloadFont(url, context)
  context.fonts.set(url, pending)

  return pending
}
