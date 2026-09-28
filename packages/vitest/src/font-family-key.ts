/** Font URLs and CSS spell the gaps in a name as `+`, `-`, `_` or spaces. */
const SEPARATORS = /[\s+_-]+/g

function unquoted(name: string): string {
  const first = name[0]
  const isQuoted = name.length >= 2 && (first === '"' || first === "'") && name.endsWith(first)

  return isQuoted ? name.slice(1, -1) : name
}

/**
 * The key two spellings of one font family share, so `Noto+Sans+Arabic`,
 * `'Noto Sans Arabic'` and `noto-sans-arabic` compare equal.
 */
export function fontFamilyKey(name: string): string {
  return unquoted(name.trim().toLowerCase()).replace(SEPARATORS, ' ').trim()
}
