/**
 * The identity of a sidebar selection: a module plus a suite path inside it.
 * A module-level selection has an empty path, so its key ends with `::`.
 */
export function suiteKey(moduleId: string, path: string[]): string {
  return `${moduleId}::${path.join(' > ')}`
}

/** The inverse of `suiteKey`. A key without a separator is read as a whole module. */
export function parseSuiteKey(key: string): { moduleId: string; path: string[] } {
  const cut = key.indexOf('::')
  if (cut < 0) {
    return { moduleId: key, path: [] }
  }

  const tail = key.slice(cut + 2)

  return { moduleId: key.slice(0, cut), path: tail ? tail.split(' > ') : [] }
}
