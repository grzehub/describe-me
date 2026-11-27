import type { DataDir } from './data-dir.js'
import { resolveAssetUrls } from './resolve-asset-urls.js'
import type { SerializedNode } from './serialized-node.js'

/**
 * Fetch and parse one serialized DOM of a data directory, with its asset URLs
 * made absolute. Its stored stylesheets are still references, which
 * `restoreStyles()` puts back.
 */
export async function fetchSnapshot(
  path: string,
  dir: DataDir = '__data',
): Promise<SerializedNode> {
  const response = await fetch(`${dir}/${path}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`snapshot ${path}: ${response.status}`)
  }

  return JSON.parse(resolveAssetUrls(await response.text(), dir)) as SerializedNode
}
