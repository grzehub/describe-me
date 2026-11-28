import type { Manifest } from '@describe-me/core/types'
import type { ChangesReport } from '../cli/changes-report.js'
import type { DataDir } from './data-dir.js'
import { fetchChanges } from './fetch-changes.js'
import { fetchManifest } from './fetch-manifest.js'
import { fetchSnapshot } from './fetch-snapshot.js'
import { rerender } from './rerender.js'
import { restoreStyles } from './restore-styles.js'
import type { SerializedNode } from './serialized-node.js'
import { state } from './state.js'
import { syncSelection } from './sync-selection.js'
import { withoutEmptyTests } from './without-empty-tests.js'

const snapshotCache = new Map<string, Promise<SerializedNode>>()

/** Which runs a report compares, so a report fetched again for the same runs counts as the same. */
function runsOf(report: ChangesReport | null): string {
  return report === null ? '' : JSON.stringify([report.base.generatedAt, report.head.generatedAt])
}

/**
 * The base run's manifest for `changes`: the one in `state` while it is for
 * the same run, else fetched from `__base/`. `null` without a report, for a
 * manifest that does not load and for one of another run. Never throws.
 */
async function baseManifestFor(changes: ChangesReport | null): Promise<Manifest | null> {
  if (changes === null) {
    return null
  }

  if (state.baseManifest?.generatedAt === changes.base.generatedAt) {
    return state.baseManifest
  }

  try {
    const base = await fetchManifest('__base')

    return base.generatedAt === changes.base.generatedAt ? base : null
  } catch {
    return null
  }
}

/** Fetch a base manifest that did not load again, and repaint only once it does. */
async function retryBaseManifest(changes: ChangesReport): Promise<void> {
  const base = await baseManifestFor(changes)

  // Another load may have put a report for another base run in place meanwhile.
  if (
    base === null ||
    state.baseManifest !== null ||
    state.changes?.base.generatedAt !== base.generatedAt
  ) {
    return
  }

  state.baseManifest = base
  rerender()
}

/**
 * Fetch the manifest, and the report against the base when `index.html`
 * names one, and repaint, but only if either differs from the one on screen.
 * Polling an unchanged static site must not re-render or drop caches. A
 * report for another run than the manifest's is left out. With a report the
 * base run's manifest comes too, before the first paint that has the report,
 * and once per base run. A base manifest that did not load is fetched again
 * on the next load, which repaints only once it succeeds.
 */
export async function loadManifest(): Promise<void> {
  const [fetched, report] = await Promise.all([fetchManifest(), fetchChanges()])
  const next = withoutEmptyTests(fetched)
  const changes = report?.head.generatedAt === next.generatedAt ? report : null
  const manifestChanged = state.manifest?.generatedAt !== next.generatedAt

  if (!manifestChanged && runsOf(state.changes) === runsOf(changes)) {
    if (changes !== null && state.baseManifest === null) {
      await retryBaseManifest(changes)
    }

    return
  }

  const baseManifest = await baseManifestFor(changes)

  if (manifestChanged) {
    state.manifest = next
    snapshotCache.clear()
  }

  state.changes = changes
  state.baseManifest = baseManifest
  syncSelection()
  rerender()
}

/**
 * Fetch one serialized DOM, memoized until the next manifest load. The promise
 * resolves with asset URLs made absolute and stored stylesheets put back, so
 * the stage and the gallery thumbnails always rebuild complete CSS and measure
 * styled boxes. A snapshot that failed or came back with missing styles is not
 * kept, so its next paint loads it again.
 */
export function loadSnapshot(path: string, dir: DataDir = '__data'): Promise<SerializedNode> {
  // Both directories can hold a file of the same name.
  const key = `${dir}/${path}`
  const memo = snapshotCache.get(key)
  if (memo) {
    return memo
  }

  // A new manifest may have replaced the entry by the time this one settles.
  const forget = (): void => {
    if (snapshotCache.get(key) === pending) {
      snapshotCache.delete(key)
    }
  }

  const pending = fetchSnapshot(path, dir).then(async (node) => {
    if (!(await restoreStyles(node, dir))) {
      forget()
    }

    return node
  })

  pending.catch(forget)
  snapshotCache.set(key, pending)

  return pending
}
