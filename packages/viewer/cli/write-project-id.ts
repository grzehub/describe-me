import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** As long as the content names of the stores. */
const ID_LENGTH = 16

function readManifest(file: string): Record<string, unknown> | null {
  try {
    const manifest: unknown = JSON.parse(readFileSync(file, 'utf8'))

    return typeof manifest === 'object' && manifest !== null
      ? (manifest as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * Replace the absolute `root` in the manifest of a built site's data
 * directory with an id of the project, so the site does not name the machine
 * that built it. The id stays the same for a checkout, so the viewer's storage
 * keys stay apart for two projects on one origin.
 */
export function writeProjectId(dataDir: string): void {
  const file = join(dataDir, 'manifest.json')
  const manifest = readManifest(file)

  // The build has already warned when there was no data to copy.
  if (manifest === null || typeof manifest.root !== 'string') {
    return
  }

  manifest.root = createHash('sha1').update(manifest.root).digest('hex').slice(0, ID_LENGTH)
  writeFileSync(file, JSON.stringify(manifest, null, 2))
}
