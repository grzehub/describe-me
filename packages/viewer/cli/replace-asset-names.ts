import { ASSET_URL_PREFIX } from '@describe-me/core/types'

/** A stored asset's name: a content hash and, when the file has one, its extension. */
const ASSET_REFERENCE = new RegExp(`${ASSET_URL_PREFIX}([0-9a-f]{16}(?:\\.[a-z0-9]+)?)`, 'g')

/** The text with each `describe-me-asset:` name that `renames` maps replaced by its new name. */
export function replaceAssetNames(text: string, renames: Map<string, string>): string {
  if (renames.size === 0) {
    return text
  }

  return text.replace(ASSET_REFERENCE, (reference: string, name: string) => {
    const renamed = renames.get(name)

    return renamed === undefined ? reference : `${ASSET_URL_PREFIX}${renamed}`
  })
}
