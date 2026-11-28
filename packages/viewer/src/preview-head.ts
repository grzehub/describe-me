import type { Manifest } from '@describe-me/core/types'
import type { DataDir } from './data-dir.js'
import { resolveAssetUrls } from './resolve-asset-urls.js'
import { state } from './state.js'

const memos = new Map<DataDir, { generatedAt: string; html: string }>()

/**
 * The manifest's preview head, with asset URLs made absolute against its data
 * directory, ready to go into every replayed frame. Empty when the manifest
 * has none.
 */
export function previewHeadHtml(
  manifest: Manifest | null = state.manifest,
  dir: DataDir = '__data',
): string {
  if (!manifest) {
    return ''
  }

  let memo = memos.get(dir)

  if (memo?.generatedAt !== manifest.generatedAt) {
    memo = { generatedAt: manifest.generatedAt, html: resolveAssetUrls(manifest.head ?? '', dir) }
    memos.set(dir, memo)
  }

  return memo.html
}
