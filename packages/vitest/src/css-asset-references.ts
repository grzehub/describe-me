import { cssReferences } from '@describe-me/core/css-references'

/** A stored asset's name: a content hash and, when the file has one, its extension. */
const ASSET_NAME = /^[0-9a-f]{16}(\.[a-z0-9]+)?$/

/**
 * The stored asset names a stored CSS asset refers to. The asset store writes
 * them as bare sibling names, so garbage collection can follow them.
 */
export function cssAssetReferences(css: string): string[] {
  const names: string[] = []

  for (const { url } of cssReferences(css)) {
    const name = url.split(/[?#]/)[0]
    if (ASSET_NAME.test(name)) {
      names.push(name)
    }
  }

  return names
}
