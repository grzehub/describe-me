/** The parts of a value between its top-level commas, so `rgb(0 0 0 / 0.1)` and `var(--x, y)` stay whole. */
export function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim())
      start = i + 1
    }
  }

  parts.push(value.slice(start).trim())

  return parts.filter((part) => part !== '')
}
