import { ASSET_URL_PREFIX } from '@describe-me/core/types'

/**
 * Make stored asset URLs absolute against the page, because a snapshot replays
 * in a sandboxed iframe that has no base URL of its own.
 */
export function resolveAssetUrls(text: string): string {
  return text.replaceAll(ASSET_URL_PREFIX, new URL('__data/assets/', location.href).href)
}
