import { STYLE_URL_PREFIX } from '@describe-me/core/types'
import { loadStyle } from './load-style.js'
import type { SerializedNode } from './serialized-node.js'

/** What the walk reads of a serialized node: an element's attributes and its children. */
interface WalkedNode {
  attributes?: Record<string, unknown>
  childNodes?: WalkedNode[]
}

/** A node whose stylesheet is stored in `styles/`, and the reference that points there. */
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
 * Put back, in place, every stylesheet a snapshot stores as a reference, so
 * rrweb rebuilds the frame with its CSS. Snapshots written before stylesheets
 * moved to `styles/` have no references and are left as they are.
 */
export async function restoreStyles(node: SerializedNode): Promise<void> {
  const stored = storedSheets(node)

  await Promise.all(
    stored.map(async ({ attributes, reference }) => {
      attributes._cssText = await loadStyle(reference)
    }),
  )
}
