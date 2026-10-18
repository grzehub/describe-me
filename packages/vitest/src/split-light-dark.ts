const OPENING = 'light-dark('

/**
 * The two halves of a `light-dark(a, b)` value, split at its one top-level
 * comma, so `light-dark(rgb(17, 17, 17), rgb(237, 237, 237))` works. Null for
 * anything else.
 */
export function splitLightDark(value: string): { light: string; dark: string } | null {
  const text = value.trim()

  if (!text.toLowerCase().startsWith(OPENING) || !text.endsWith(')')) {
    return null
  }

  const inner = text.slice(OPENING.length, -1)
  let depth = 0
  let comma = -1

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i]

    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
    } else if (char === ',' && depth === 0) {
      if (comma !== -1) {
        return null
      }

      comma = i
    }

    // A `)` that closes `light-dark(` before the end leaves text outside it.
    if (depth < 0) {
      return null
    }
  }

  if (comma === -1 || depth !== 0) {
    return null
  }

  const light = inner.slice(0, comma).trim()
  const dark = inner.slice(comma + 1).trim()

  if (light === '' || dark === '') {
    return null
  }

  return { light, dark }
}
