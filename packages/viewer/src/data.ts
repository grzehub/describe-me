import type { rebuildIntoSandboxedIframe } from 'rrweb-snapshot'
import { ASSET_URL_PREFIX, type Manifest } from '@describe-me/core/types'
import { allTests, currentTest, state } from './state.js'
import { rerender } from './rerender.js'

/** rrweb's serialized document node; the package does not re-export the type. */
type SerializedNode = Parameters<typeof rebuildIntoSandboxedIframe>[0]

const snapshotCache = new Map<string, Promise<SerializedNode>>()

/**
 * Fetch the manifest and repaint, but only if it differs from the one on
 * screen. Polling an unchanged static site must not re-render or drop caches.
 */
export async function loadManifest(): Promise<void> {
  const response = await fetch('__data/manifest.json', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`manifest: ${response.status}`)
  }

  const next = (await response.json()) as Manifest
  if (state.manifest?.generatedAt === next.generatedAt) {
    return
  }

  state.manifest = next
  snapshotCache.clear()
  if (!currentTest()) {
    const first = allTests(state.manifest)[0]
    state.testId = first?.id ?? null
    state.frame = 0
  }

  const test = currentTest()
  if (test) {
    state.frame = Math.min(state.frame, Math.max(0, test.frames.length - 1))
  }

  rerender()
}

/**
 * Fetch one serialized DOM, memoized until the next manifest load. Asset URLs
 * are made absolute here, against the page, because the snapshot replays in a
 * sandboxed iframe that has no base URL of its own. The stage and the gallery
 * thumbnails both load through this.
 */
export function loadSnapshot(path: string): Promise<SerializedNode> {
  let pending = snapshotCache.get(path)
  if (!pending) {
    pending = fetch(`__data/${path}`, { cache: 'no-store' })
      .then((response) => response.text())
      .then((json) => parseSnapshot(json))

    snapshotCache.set(path, pending)
  }

  return pending
}

function parseSnapshot(json: string): SerializedNode {
  const assetsUrl = new URL('__data/assets/', location.href).href

  return JSON.parse(json.replaceAll(ASSET_URL_PREFIX, assetsUrl)) as SerializedNode
}
