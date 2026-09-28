import { CHROME_USER_AGENT } from './chrome-user-agent.js'
import type { FontKind } from './font-provider.js'
import { fontProvider } from './font-provider.js'

/** How to request one file. */
export interface DownloadOptions {
  /** What the URL must stay after every redirect. */
  kind: FontKind
  fetch: typeof fetch
  timeoutMs: number
  maxBytes: number
  /** Hosts that failed on the network in this run, with the reason. Read and written. */
  unreachableHosts: Map<string, string>
}

/** A downloaded body, or why there is none. `network` marks a failure before any HTTP answer. */
export type DownloadResult =
  | { ok: true; bytes: Uint8Array; finalUrl: string; contentType: string }
  | { ok: false; reason: string; network: boolean }

const MAX_REDIRECTS = 5

const STYLESHEET_ACCEPT = 'text/css,*/*;q=0.1'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function failure(reason: string, network = false): DownloadResult {
  return { ok: false, reason, network }
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

/** Node rejects with `TypeError('fetch failed')` and keeps the system error code in `cause`. */
function networkReason(error: unknown, timeoutMs: number): string {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `no answer within ${timeoutMs / 1000} s`
  }

  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code
  if (typeof code === 'string') {
    return code
  }

  return error instanceof Error ? error.message : String(error)
}

function headersFor(kind: FontKind): Record<string, string> {
  if (kind === 'stylesheet') {
    return { 'User-Agent': CHROME_USER_AGENT, Accept: STYLESHEET_ACCEPT }
  }

  return { 'User-Agent': CHROME_USER_AGENT }
}

/** The body, or null once it grows past `maxBytes`. */
async function readBody(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const length = response.headers.get('content-length')
  if (length !== null && Number(length) > maxBytes) {
    await response.body?.cancel()
    return null
  }

  if (response.body === null) {
    return new Uint8Array()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let chunk = await reader.read()

  while (!chunk.done) {
    total += chunk.value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }

    chunks.push(chunk.value)
    chunk = await reader.read()
  }

  return Buffer.concat(chunks)
}

/** `url` resolved against `base` and upgraded to `https:`, or null for other schemes. */
function httpsUrl(url: string, base: URL): URL | null {
  if (!URL.canParse(url, base)) {
    return null
  }

  const target = new URL(url, base)
  if (target.protocol === 'http:') {
    target.protocol = 'https:'
  }

  return target.protocol === 'https:' ? target : null
}

/** The next hop of a redirect, checked against the allowlist before it is requested. */
function nextHop(response: Response, current: URL, kind: FontKind): DownloadResult | URL {
  const location = response.headers.get('location')
  if (location === null) {
    return failure(`HTTP ${response.status} without a location`)
  }

  const target = httpsUrl(location, current)
  if (target === null) {
    return failure('redirect to an invalid URL')
  }

  const provider = fontProvider(target)
  if (!provider?.vendorable || provider.kind !== kind) {
    return failure(`redirect to ${target.hostname}, off the font allowlist`)
  }

  return target
}

/** One request. A URL is the next hop of a redirect. */
async function request(url: URL, options: DownloadOptions): Promise<DownloadResult | URL> {
  const response = await options.fetch(url.href, {
    headers: headersFor(options.kind),
    redirect: 'manual',
    signal: AbortSignal.timeout(options.timeoutMs),
  })

  if (REDIRECT_STATUSES.has(response.status)) {
    await response.body?.cancel()
    return nextHop(response, url, options.kind)
  }

  if (!response.ok) {
    await response.body?.cancel()
    return failure(`HTTP ${response.status}`)
  }

  const bytes = await readBody(response, options.maxBytes)
  if (bytes === null) {
    return failure(`larger than ${megabytes(options.maxBytes)}`)
  }

  const contentType = response.headers.get('content-type') ?? ''

  return { ok: true, bytes, finalUrl: url.href, contentType }
}

/**
 * Download one file from an allowlisted `https:` URL. Redirects are followed
 * by hand and must stay on the allowlist with the same kind. Never throws.
 */
export async function download(url: URL, options: DownloadOptions): Promise<DownloadResult> {
  let current = httpsUrl(url.href, url)
  if (current === null) {
    return failure('not an http(s) URL')
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const unreachable = options.unreachableHosts.get(current.hostname)
    if (unreachable !== undefined) {
      return failure(unreachable, true)
    }

    let outcome: DownloadResult | URL
    try {
      outcome = await request(current, options)
    } catch (error) {
      const reason = networkReason(error, options.timeoutMs)
      options.unreachableHosts.set(current.hostname, reason)

      return failure(reason, true)
    }

    if (!(outcome instanceof URL)) {
      return outcome
    }

    current = outcome
  }

  return failure(`more than ${MAX_REDIRECTS} redirects`)
}
