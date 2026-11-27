import type { Manifest } from '@describe-me/core/types'
import type { DataDir } from './data-dir.js'

/** Fetch the manifest of a data directory as the reporter wrote it, past any HTTP cache. */
export async function fetchManifest(dir: DataDir = '__data'): Promise<Manifest> {
  const response = await fetch(`${dir}/manifest.json`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`manifest: ${response.status}`)
  }

  return (await response.json()) as Manifest
}
