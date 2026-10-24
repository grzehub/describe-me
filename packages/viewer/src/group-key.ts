/**
 * The `CollapsedSuites` key of a sidebar group. It never equals a `suiteKey()`,
 * which always holds `::`, because an encoded name holds no `:`. So groups
 * share the store, and its storage key, with the suites stored by earlier versions.
 */
export function groupKey(path: string[]): string {
  return `group:${path.map(encodeURIComponent).join('/')}`
}
