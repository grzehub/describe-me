/**
 * The 1-based line numbers of `text` from the first line that contains
 * `from` to the next line after it that is exactly `to`, both included, so a
 * closing brace means the one at that indent. With `to` left out, only the
 * `from` line.
 */
export function linesBetween(text, from, to) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.includes(from))

  if (start < 0) {
    throw new Error(`no line contains ${JSON.stringify(from)}`)
  }

  if (to === undefined) {
    return [start + 1]
  }

  const end = lines.findIndex((line, index) => index > start && line === to)

  if (end < 0) {
    throw new Error(`no line after ${JSON.stringify(from)} is ${JSON.stringify(to)}`)
  }

  return Array.from({ length: end - start + 1 }, (_, offset) => start + 1 + offset)
}
