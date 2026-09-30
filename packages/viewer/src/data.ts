import type { Manifest } from '@describe-me/core/types'
import { rerender } from './rerender.js'
import { resolveAssetUrls } from './resolve-asset-urls.js'
import { restoreStyles } from './restore-styles.js'
import type { SerializedNode } from './serialized-node.js'
import { state } from './state.js'
import { syncSelection } from './sync-selection.js'
import { withoutEmptyTests } from './without-empty-tests.js'

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

  const next = withoutEmptyTests((await response.json()) as Manifest)
  if (state.manifest?.generatedAt === next.generatedAt) {
    return
  }

  state.manifest = next
  snapshotCache.clear()
  syncSelection()
  rerender()
}

/**
 * Fetch one serialized DOM, memoized until the next manifest load. The promise
 * resolves with asset URLs made absolute and stored stylesheets put back, so
 * the stage and the gallery thumbnails always rebuild complete CSS and measure
 * styled boxes. A snapshot that failed or came back with missing styles is not
 * kept, so its next paint loads it again.
 */
export function loadSnapshot(path: string): Promise<SerializedNode> {
  const memo = snapshotCache.get(path)
  if (memo) {
    return memo
  }

  // A new manifest may have replaced the entry by the time this one settles.
  const forget = (): void => {
    if (snapshotCache.get(path) === pending) {
      snapshotCache.delete(path)
    }
  }

  const pending = fetchSnapshot(path).then(async (node) => {
    if (!(await restoreStyles(node))) {
      forget()
    }

    return node
  })

  pending.catch(forget)
  snapshotCache.set(path, pending)

  return pending
}

async function fetchSnapshot(path: string): Promise<SerializedNode> {
  const response = await fetch(`__data/${path}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`snapshot ${path}: ${response.status}`)
  }

  return parseSnapshot(await response.text())
}

function parseSnapshot(json: string): SerializedNode {
  return JSON.parse(resolveAssetUrls(json)) as SerializedNode
}
