import { ASSET_URL_PREFIX } from '@describe-me/core/types'

/**
 * Make the asset URLs in stored text absolute, against the page: a snapshot
 * replays in a sandboxed iframe that has no base URL of its own.
 */
export function resolveAssetUrls(text: string): string {
  return text.replaceAll(ASSET_URL_PREFIX, new URL('__data/assets/', location.href).href)
}
