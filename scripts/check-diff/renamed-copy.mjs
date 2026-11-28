import { cpSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Copy a data directory to `to` with every snapshot file renamed and the
 * manifest's paths updated, so each frame of the copy pairs with the same
 * DOM under another name: a change only in CSS that renders the same.
 */
export function renamedCopy(from, to) {
  cpSync(from, to, { recursive: true })

  const snapshots = join(to, 'snapshots')

  for (const file of readdirSync(snapshots)) {
    renameSync(join(snapshots, file), join(snapshots, `copy-${file}`))
  }

  const manifestFile = join(to, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))

  for (const mod of manifest.modules) {
    for (const test of mod.tests) {
      for (const frame of test.frames) {
        frame.snapshot = frame.snapshot.replace(/^snapshots\//, 'snapshots/copy-')
      }
    }
  }

  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))

  return to
}
