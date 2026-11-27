import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Read and parse a frame's snapshot file. A missing file or one that is not JSON throws. */
export function readSnapshot(dir: string, snapshot: string): unknown {
  const file = join(dir, snapshot)

  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new Error(`cannot read ${file}`)
  }
}
