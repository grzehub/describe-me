import { ASSET_URL_PREFIX } from '@describe-me/core/types'
import type { DataDir } from './data-dir.js'

/**
 * Make stored asset URLs absolute against the page, because a snapshot replays
 * in a sandboxed iframe that has no base URL of its own.
 */
export function resolveAssetUrls(text: string, dir: DataDir = '__data'): string {
  return text.replaceAll(ASSET_URL_PREFIX, new URL(`${dir}/assets/`, location.href).href)
}
