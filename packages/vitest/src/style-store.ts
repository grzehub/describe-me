import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { STYLE_URL_PREFIX } from '@describe-me/core/types'
import { collectableFiles } from './collectable-files.js'
import { splitStylesheet } from './split-stylesheet.js'

/** Shorter sheets stay inline, where they cost less than a reference and a file of their own. */
const MIN_EXTRACTED_LENGTH = 256

/**
 * Inside a JSON string every `"` is escaped, so only a real `_cssText` key
 * matches. Unrolled, because `(?:[^"\\]|\\.)*` is much slower on
 * megabyte-long sheets.
 */
const CSS_TEXT_MEMBER = /"_cssText":"([^"\\]*(?:\\.[^"\\]*)*)"/g

const STYLE_REFERENCE = new RegExp(`${STYLE_URL_PREFIX}([0-9a-f]{16}(?:\\+[0-9a-f]{16})*)`, 'g')

/**
 * Content-addressed store for the stylesheets rrweb copies into every capture,
 * living in `<outDir>/styles`. A sheet is stored once, in chunks, so one that
 * grows from test to test shares most of them.
 */
export class StyleStore {
  private readonly outDir: string
  private readonly dir: string
  /** Snapshots are content-addressed, so a cached entry never goes stale. */
  private readonly referencesBySnapshot = new Map<string, string[]>()

  constructor(outDir: string) {
    this.outDir = outDir
    this.dir = join(outDir, 'styles')
    mkdirSync(this.dir, { recursive: true })
  }

  /**
   * Replace each long `_cssText` in a serialized snapshot with a reference to
   * its chunks, writing the ones not stored yet. Idempotent.
   */
  extract(json: string): string {
    return json.replace(CSS_TEXT_MEMBER, (member: string, escaped: string) => {
      const css = JSON.parse(`"${escaped}"`) as string
      if (css.length < MIN_EXTRACTED_LENGTH || css.startsWith(STYLE_URL_PREFIX)) {
        return member
      }

      const hashes = splitStylesheet(css).map((chunk) => this.write(chunk))

      return `"_cssText":"${STYLE_URL_PREFIX}${hashes.join('+')}"`
    })
  }

  /**
   * Drop the chunks no kept snapshot refers to, and return the kept ones as
   * sorted `styles/<hash>.css` paths for the asset store. Paths are relative to
   * the output directory, as the manifest stores them.
   */
  collectGarbage(snapshotFiles: Iterable<string>): string[] {
    const keep = new Set<string>()
    for (const snapshotFile of snapshotFiles) {
      for (const hash of this.referencesIn(snapshotFile)) {
        keep.add(`${hash}.css`)
      }
    }

    const kept: string[] = []
    for (const file of collectableFiles(this.dir)) {
      if (keep.has(file)) {
        kept.push(`styles/${file}`)
      } else {
        rmSync(join(this.dir, file), { force: true })
      }
    }

    return kept.sort()
  }

  private write(chunk: string): string {
    const hash = createHash('sha1').update(chunk).digest('hex').slice(0, 16)
    const file = join(this.dir, `${hash}.css`)
    // Not remembered in memory: in watch mode, GC can delete the file between runs.
    if (!existsSync(file)) {
      writeFileSync(file, chunk)
    }

    return hash
  }

  private referencesIn(snapshotFile: string): string[] {
    const cached = this.referencesBySnapshot.get(snapshotFile)
    if (cached) {
      return cached
    }

    const path = join(this.outDir, snapshotFile)
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      return []
    }

    const json = readFileSync(path, 'utf8')
    const hashes = Array.from(json.matchAll(STYLE_REFERENCE), (match) => match[1].split('+')).flat()
    this.referencesBySnapshot.set(snapshotFile, hashes)

    return hashes
  }
}
