/** The test that the page URL names, or why the URL names none. */
export type LiveParams = { file: string; path: string[]; occurrence: number } | { problem: string }

const OCCURRENCE = /^[1-9]\d*$/

/**
 * A path relative to the root. These rules keep a `file` such as
 * `//host/x.js`, which `import('/' + file)` would load from that host, out.
 */
function isRelativePath(file: string): boolean {
  if (file === '' || file.startsWith('/') || file.includes(':')) {
    return false
  }

  return !file.split('/').includes('..')
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
export function readLiveParams(search: string): LiveParams {
  const params = new URLSearchParams(search)
  const file = params.get('file')?.replaceAll('\\', '/') ?? null

  if (file === null || !isRelativePath(file)) {
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
