import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Content-addressed store for the serialized DOM of every frame, living in
 * `<outDir>/snapshots`. Identical DOM across tests or runs is written once.
 */
export class SnapshotStore {
  private readonly dir: string

  constructor(outDir: string) {
    this.dir = join(outDir, 'snapshots')
    mkdirSync(this.dir, { recursive: true })
  }

  /** Write one snapshot and return its path relative to the manifest. */
  write(snapshot: unknown): string {
    const json = JSON.stringify(snapshot)
    const hash = createHash('sha1').update(json).digest('hex').slice(0, 16)
    const file = `${hash}.json`
    const abs = join(this.dir, file)
    if (!existsSync(abs)) writeFileSync(abs, json)
    return `snapshots/${file}`
  }

  /** Drop the files no manifest frame points at any more. */
  collectGarbage(referenced: Iterable<string>): void {
    const keep = new Set<string>()
    for (const path of referenced) keep.add(path.replace('snapshots/', ''))
    for (const file of readdirSync(this.dir)) {
      if (!keep.has(file)) rmSync(join(this.dir, file), { force: true })
    }
  }
}
