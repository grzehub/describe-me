import type { DataDir } from './data-dir.js'
import { resolveAssetUrls } from './resolve-asset-urls.js'

/** How long a failed chunk waits before its one retry. */
const RETRY_DELAY_MS = 500

/** A stylesheet put back together, and whether every chunk of it arrived. */
export interface LoadedStyle {
  css: string
  complete: boolean
}

/**
 * The caches of one data directory. A chunk's text has its asset URLs resolved
 * against its own directory, so one directory's cache never serves another.
 */
interface StyleCaches {
  /**
   * Chunk texts by hash, kept as promises so parallel thumbnails share one
   * request. Never cleared, because a hash always names the same text.
   */
  chunks: Map<string, Promise<string | null>>
  /** Joined sheets by reference, so every snapshot using a sheet shares one string. */
  sheets: Map<string, Promise<LoadedStyle>>
}

const caches = new Map<DataDir, StyleCaches>()

function cachesOf(dir: DataDir): StyleCaches {
  let found = caches.get(dir)

  if (found === undefined) {
    found = { chunks: new Map(), sheets: new Map() }
    caches.set(dir, found)
  }

  return found
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchOnce(hash: string, dir: DataDir, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(`${dir}/styles/${hash}.css`, init)

    return response.ok ? resolveAssetUrls(await response.text(), dir) : null
  } catch {
    return null
  }
}

async function fetchChunk(hash: string, dir: DataDir): Promise<string | null> {
  // Default caching: the name is a content hash, so a cached copy is always right.
  const first = await fetchOnce(hash, dir)
  if (first !== null) {
    return first
  }

  // A chunk may be missing for a moment while a site redeploys. The retry
  // bypasses the HTTP cache, which may have kept the 404.
  await delay(RETRY_DELAY_MS)

  return fetchOnce(hash, dir, { cache: 'reload' })
}

function loadChunk(hash: string, dir: DataDir): Promise<string | null> {
  const { chunks } = cachesOf(dir)
  const memo = chunks.get(hash)
  if (memo) {
    return memo
  }

  const pending = fetchChunk(hash, dir).then((css) => {
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
export function loadStyle(reference: string, dir: DataDir = '__data'): Promise<LoadedStyle> {
  const { sheets } = cachesOf(dir)
  const memo = sheets.get(reference)
  if (memo) {
    return memo
  }

  const loads = reference.split('+').map((hash) => loadChunk(hash, dir))
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
