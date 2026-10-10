/** The test that the page URL names, or why the URL names none. */
export type LiveParams = { file: string; path: string[]; occurrence: number } | { problem: string }

/** The parts of `window.location` that the page reads. */
export interface LivePageLocation {
  search: string
  origin: string
}

const OCCURRENCE = /^[1-9]\d*$/

function hasControlCharacter(text: string): boolean {
  return Array.from(text).some((character) => {
    const code = character.charCodeAt(0)

    return code < 0x20 || code === 0x7f
  })
}

/** Whether `/file` on the page's origin names exactly that file, with no query, hash or dot segment. */
function namesOnlyFile(file: string, origin: string): boolean {
  try {
    const url = new URL(`/${file}`, origin)
    const exact = decodeURIComponent(url.pathname) === `/${file}`

    return url.origin === origin && url.search === '' && url.hash === '' && exact
  } catch {
    return false
  }
}

/**
 * A path relative to the root that stays on the page's origin. The URL
 * parser drops tabs and newlines and reads a leading `//` as another host, so
 * a `file` such as `\t/host/x.js` would load code from that host. The last
 * rule checks the URL the page imports, not only the text.
 */
function isRelativePath(file: string, origin: string): boolean {
  if (file === '' || file.startsWith('/') || file.includes(':') || hasControlCharacter(file)) {
    return false
  }

  return !file.split('/').includes('..') && namesOnlyFile(file, origin)
}

function namesOf(text: string | null): string[] | null {
  if (text === null) {
    return null
  }

  try {
    const names: unknown = JSON.parse(text)
    const valid =
      Array.isArray(names) && names.length > 0 && names.every((name) => typeof name === 'string')

    return valid ? (names as string[]) : null
  } catch {
    return null
  }
}

/**
 * Reads `file`, `path` and `occurrence` from the query of the live page.
 * `path` holds the suite names, outermost first, then the test name.
 */
export function readLiveParams(location: LivePageLocation): LiveParams {
  const params = new URLSearchParams(location.search)
  const file = params.get('file')?.replaceAll('\\', '/') ?? null

  if (file === null || !isRelativePath(file, location.origin)) {
    return { problem: `file must be a path relative to the root, got ${JSON.stringify(file)}` }
  }

  const path = namesOf(params.get('path'))

  if (path === null) {
    return { problem: 'path must be a JSON array of the suite names and the test name' }
  }

  const occurrence = params.get('occurrence') ?? '1'

  if (!OCCURRENCE.test(occurrence)) {
    return { problem: `occurrence must be a positive integer, got ${JSON.stringify(occurrence)}` }
  }

  return { file, path, occurrence: Number(occurrence) }
}
