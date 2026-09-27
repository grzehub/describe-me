import { resolveAssetUrls } from './resolve-asset-urls.js'
import { state } from './state.js'

let memo: { generatedAt: string; html: string } | null = null

/**
 * The manifest's preview head, with asset URLs made absolute, ready to go into
 * every replayed frame. Empty when the manifest has none.
 */
export function previewHeadHtml(): string {
  const manifest = state.manifest
  if (!manifest) {
    return ''
  }

  if (memo?.generatedAt !== manifest.generatedAt) {
    memo = { generatedAt: manifest.generatedAt, html: resolveAssetUrls(manifest.head ?? '') }
  }

  return memo.html
}
