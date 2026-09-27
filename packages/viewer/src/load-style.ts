import { resolveAssetUrls } from './resolve-asset-urls.js'

/**
 * Chunk texts by hash, as promises, so parallel thumbnails share one request.
 * Never cleared: a content hash names the same text forever. A failed chunk
 * resolves to null and removes itself, so the next load asks again.
 */
const chunks = new Map<string, Promise<string | null>>()

/** Joined stylesheets by reference, so every snapshot using a sheet gets the same string. */
const sheets = new Map<string, Promise<string>>()

/** One chunk's text with its asset URLs resolved, or null when it cannot be fetched. */
async function fetchChunk(hash: string): Promise<string | null> {
  try {
    // Default caching: the name is a content hash, so a cached copy is always right.
    const response = await fetch(`__data/styles/${hash}.css`)

    return response.ok ? resolveAssetUrls(await response.text()) : null
  } catch {
    return null
  }
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
 * The stylesheet behind a style reference, the text after `STYLE_URL_PREFIX`:
 * its chunks, fetched in parallel and joined in order. A chunk that does not
 * load leaves a gap instead of failing the frame, and the reference is loaded
 * again next time.
 */
export function loadStyle(reference: string): Promise<string> {
  const memo = sheets.get(reference)
  if (memo) {
    return memo
  }

  const loads = reference.split('+').map((hash) => loadChunk(hash))
  const pending = Promise.all(loads).then((texts) => {
    if (texts.includes(null)) {
      sheets.delete(reference)
    }

    return texts.map((text) => text ?? '').join('')
  })

  sheets.set(reference, pending)

  return pending
}
