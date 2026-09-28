import { createCache } from 'rrweb-snapshot'
import type { BuildCache } from 'rrweb-snapshot'
import { state } from './state.js'

let memo: { generatedAt: string | undefined; cache: BuildCache } | null = null

/**
 * rrweb caches its CSS adaptation per CSS text, so the stage and the gallery
 * share one cache. There is one per manifest, so a long dev session does not
 * keep every CSS text it ever adapted.
 */
export function replayCache(): BuildCache {
  const generatedAt = state.manifest?.generatedAt
  if (!memo || memo.generatedAt !== generatedAt) {
    memo = { generatedAt, cache: createCache() }
  }

  return memo.cache
}
