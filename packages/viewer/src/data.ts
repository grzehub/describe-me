import type { rebuildIntoSandboxedIframe } from 'rrweb-snapshot'
import type { Manifest } from '@describe-me/core/types'
import { allTests, currentTest, state } from './state.js'
import { rerender } from './rerender.js'

/** rrweb's serialized document node; the package does not re-export the type. */
type SerializedNode = Parameters<typeof rebuildIntoSandboxedIframe>[0]

const snapshotCache = new Map<string, Promise<SerializedNode>>()

/** Fetch the manifest, keep the selection if it still exists, repaint. */
export async function loadManifest(): Promise<void> {
  const res = await fetch('/__data/manifest.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`manifest: ${res.status}`)
  state.manifest = (await res.json()) as Manifest
  snapshotCache.clear()
  if (!currentTest()) {
    const first = allTests(state.manifest)[0]
    state.testId = first?.id ?? null
    state.frame = 0
  }
  const test = currentTest()
  if (test) state.frame = Math.min(state.frame, Math.max(0, test.frames.length - 1))
  rerender()
}

/** Fetch one serialized DOM, memoized until the next manifest load. */
export function loadSnapshot(path: string): Promise<SerializedNode> {
  let p = snapshotCache.get(path)
  if (!p) {
    p = fetch(`/__data/${path}`, { cache: 'no-store' }).then(
      (r) => r.json() as Promise<SerializedNode>,
    )
    snapshotCache.set(path, p)
  }
  return p
}
