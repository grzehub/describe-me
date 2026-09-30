import { resolveAssetUrls } from './resolve-asset-urls.js'

/** How long a failed chunk waits before its one retry. */
const RETRY_DELAY_MS = 500

/** A stylesheet put back together, and whether every chunk of it arrived. */
export interface LoadedStyle {
  css: string
  complete: boolean
}

/**
 * Chunk texts by hash, kept as promises so parallel thumbnails share one
 * request. Never cleared, because a hash always names the same text.
 */
const chunks = new Map<string, Promise<string | null>>()

/** Joined sheets by reference, so every snapshot using a sheet shares one string. */
const sheets = new Map<string, Promise<LoadedStyle>>()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchOnce(hash: string, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(`__data/styles/${hash}.css`, init)

    return response.ok ? resolveAssetUrls(await response.text()) : null
  } catch {
    return null
  }
}

async function fetchChunk(hash: string): Promise<string | null> {
  // Default caching: the name is a content hash, so a cached copy is always right.
  const first = await fetchOnce(hash)
  if (first !== null) {
    return first
  }

  // A chunk may be missing for a moment while a site redeploys. The retry
  // bypasses the HTTP cache, which may have kept the 404.
  await delay(RETRY_DELAY_MS)

  return fetchOnce(hash, { cache: 'reload' })
}

function loadChunk(hash: string): Promise<string | null> {
  const memo = chunks.get(hash)
  if (memo) {
    return memo
  }

  const pending = fetchChunk(hash).then((css) => {
    if (css === null) {
      console.warn(`describe-me: style chunk styles/${hash}.css did not load`)
      chunks.delete(hash)
    }

    return css
  })

  chunks.set(hash, pending)

  return pending
}

/**
 * The stylesheet behind a reference, the text after `STYLE_URL_PREFIX`. A chunk
 * that fails to load leaves a gap rather than failing the frame, marks the
 * sheet incomplete and is fetched again next time.
 */
export function loadStyle(reference: string): Promise<LoadedStyle> {
  const memo = sheets.get(reference)
  if (memo) {
    return memo
  }

  const loads = reference.split('+').map((hash) => loadChunk(hash))
  const pending = Promise.all(loads).then((texts) => {
    const complete = !texts.includes(null)
    if (!complete) {
      sheets.delete(reference)
    }

    return { css: texts.map((text) => text ?? '').join(''), complete }
  })

  sheets.set(reference, pending)

  return pending
}
