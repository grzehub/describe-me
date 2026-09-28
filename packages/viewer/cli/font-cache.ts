import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** A cached response that passed validation. */
export interface CachedResponse {
  /** The URL as requested. */
  url: string
  /** The URL after redirects, which relative URLs inside a stylesheet resolve against. */
  finalUrl: string
  contentType: string
  /** `Date.now()` of the download. */
  fetchedAt: number
  body: Uint8Array
}

type CachedMeta = Omit<CachedResponse, 'body'>

function isMeta(value: unknown, url: string): value is CachedMeta {
  const meta = value as Partial<CachedMeta> | null

  return (
    typeof meta === 'object' &&
    meta !== null &&
    meta.url === url &&
    typeof meta.finalUrl === 'string' &&
    URL.canParse(meta.finalUrl) &&
    typeof meta.contentType === 'string' &&
    typeof meta.fetchedAt === 'number'
  )
}

/**
 * Downloaded stylesheets and fonts on disk, keyed by User-Agent and URL, so a
 * build works offline after one online build. Every problem counts as a miss.
 */
export class FontCache {
  private readonly dir: string
  private readonly userAgent: string

  constructor(dir: string, userAgent: string) {
    this.dir = dir
    this.userAgent = userAgent
  }

  /** The entry for `url`, or null when there is none or it cannot be read. */
  read(url: string): CachedResponse | null {
    const key = this.key(url)

    try {
      const meta: unknown = JSON.parse(readFileSync(join(this.dir, `${key}.json`), 'utf8'))
      if (!isMeta(meta, url)) {
        return null
      }

      return { ...meta, body: readFileSync(join(this.dir, `${key}.body`)) }
    } catch {
      return null
    }
  }

  /** The body goes first, so an entry whose metadata exists is complete. */
  write(entry: CachedResponse): void {
    const key = this.key(entry.url)
    const meta: CachedMeta = {
      url: entry.url,
      finalUrl: entry.finalUrl,
      contentType: entry.contentType,
      fetchedAt: entry.fetchedAt,
    }

    try {
      mkdirSync(this.dir, { recursive: true })
      writeFileSync(join(this.dir, `${key}.body`), entry.body)
      writeFileSync(join(this.dir, `${key}.json`), JSON.stringify(meta))
    } catch {
      // A read-only cache only costs the next build a download.
    }
  }

  private key(url: string): string {
    return createHash('sha1').update(`${this.userAgent}\n${url}`).digest('hex')
  }
}
