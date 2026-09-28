const MAX_SIZE = 10_000

/**
 * A viewport width or height from the hash or a toolbar field: a whole number
 * of pixels from 1 to 10000. Anything else is `null`, which means auto.
 */
export function parseViewportSize(text: string | null): number | null {
  if (!text) {
    return null
  }

  const size = Number(text)
  if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) {
    return null
  }

  return size
}
