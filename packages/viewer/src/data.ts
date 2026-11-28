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
 * Fetch the manifest, and the report against the base when `index.html`
 * names one, and repaint, but only if either differs from the one on screen.
 * Polling an unchanged static site must not re-render or drop caches. A
 * report for another run than the manifest's is left out.
 */
export async function loadManifest(): Promise<void> {
  const [fetched, report] = await Promise.all([fetchManifest(), fetchChanges()])
  const next = withoutEmptyTests(fetched)
  const changes = report?.head.generatedAt === next.generatedAt ? report : null
  const manifestChanged = state.manifest?.generatedAt !== next.generatedAt

  if (!manifestChanged && runsOf(state.changes) === runsOf(changes)) {
    return
  }

  if (manifestChanged) {
    state.manifest = next
    snapshotCache.clear()
  }

  state.changes = changes
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
