import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { STYLE_URL_PREFIX } from '@describe-me/core/types'
import { splitStylesheet } from './split-stylesheet.js'

/**
 * Sheets shorter than this stay inline: a reset or a handful of rules costs the
 * snapshot less than a reference and a file of its own would.
 */
const MIN_EXTRACTED_LENGTH = 256

/**
 * rrweb's `_cssText` member in serialized JSON, its value still escaped. Inside
 * JSON string content every `"` is escaped, so only the real key matches. The
 * unrolled form is much faster than `(?:[^"\\]|\\.)*` on megabyte-long sheets.
 */
const CSS_TEXT_MEMBER = /"_cssText":"([^"\\]*(?:\\.[^"\\]*)*)"/g

/** A stored reference: the hashes of its chunks, in order, joined by `+`. */
const STYLE_REFERENCE = new RegExp(`${STYLE_URL_PREFIX}([0-9a-f]{16}(?:\\+[0-9a-f]{16})*)`, 'g')

/**
 * Content-addressed store for the stylesheets snapshots carry, living in
 * `<outDir>/styles`. rrweb inlines the full text of every sheet on the page into
 * every capture; `extract()` moves each long one into chunk files named after
 * their hash and leaves a `STYLE_URL_PREFIX` reference in the snapshot, so a
 * sheet, or most of one that grew, is stored once however many snapshots use it.
 */
export class StyleStore {
  private readonly outDir: string
  private readonly dir: string
  /** Chunk hashes per snapshot file. Snapshots are content-addressed, so an entry never goes stale. */
  private readonly referencesBySnapshot = new Map<string, string[]>()

  constructor(outDir: string) {
    this.outDir = outDir
    this.dir = join(outDir, 'styles')
    mkdirSync(this.dir, { recursive: true })
  }

  /**
   * Replace every rrweb `_cssText` of `MIN_EXTRACTED_LENGTH` or more characters
   * in a serialized snapshot with a reference to its chunks, writing the chunks
   * that are not stored yet. Running it on its own output changes nothing.
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
   * Drop the chunks no kept snapshot refers to. Paths are relative to the output
   * directory, as the manifest stores them. Returns the kept chunks the same way
   * (`styles/<hash>.css`), sorted, so the asset store can scan them too.
   */
  collectGarbage(snapshotFiles: Iterable<string>): string[] {
    const keep = new Set<string>()
    for (const snapshotFile of snapshotFiles) {
      for (const hash of this.referencesIn(snapshotFile)) {
        keep.add(`${hash}.css`)
      }
    }

    const kept: string[] = []
    for (const file of readdirSync(this.dir)) {
      if (keep.has(file)) {
        kept.push(`styles/${file}`)
      } else {
        rmSync(join(this.dir, file), { force: true })
      }
    }

    return kept.sort()
  }

  /** Store one chunk under its hash, unless it is there already, and return the hash. */
  private write(chunk: string): string {
    const hash = createHash('sha1').update(chunk).digest('hex').slice(0, 16)
    const file = join(this.dir, `${hash}.css`)
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
