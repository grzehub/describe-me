import { STYLE_URL_PREFIX } from '@describe-me/core/types'
import { loadStyle } from './load-style.js'
import type { SerializedNode } from './serialized-node.js'

/**
 * What the walk reads. `SerializedNode` is `any` here: rrweb-snapshot's types
 * import `@rrweb/types`, which it does not install.
 */
interface WalkedNode {
  attributes?: Record<string, unknown>
  childNodes?: WalkedNode[]
}

interface StoredSheet {
  attributes: Record<string, unknown>
  reference: string
}

function storedSheets(node: WalkedNode, found: StoredSheet[] = []): StoredSheet[] {
  const cssText = node.attributes?._cssText
  if (node.attributes && typeof cssText === 'string' && cssText.startsWith(STYLE_URL_PREFIX)) {
    found.push({ attributes: node.attributes, reference: cssText.slice(STYLE_URL_PREFIX.length) })
  }

  for (const child of node.childNodes ?? []) {
    storedSheets(child, found)
  }

  return found
}

/**
 * Put every stylesheet a snapshot keeps in `styles/` back in place, before
 * rrweb rebuilds it. Resolves `false` when a sheet came back with gaps.
 * Snapshots without references pass through unchanged.
 */
export async function restoreStyles(node: SerializedNode): Promise<boolean> {
  const stored = storedSheets(node)

  const loaded = await Promise.all(
    stored.map(async ({ attributes, reference }) => {
      const style = await loadStyle(reference)
      attributes._cssText = style.css

      return style.complete
    }),
  )

  return loaded.every(Boolean)
}
