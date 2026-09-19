/**
 * Multiplier of the polynomial rolling hash, the same one `String.hashCode()`
 * uses in Java. Odd, so no bit is lost to a plain shift on every step; prime,
 * so common inputs spread evenly; and `x * 31` is just `(x << 5) - x`.
 */
const MULTIPLIER = 31

/**
 * Inexpensive, non-cryptographic hash used to tell two captures apart.
 * `| 0` keeps the accumulator a 32-bit integer, so overflow wraps like a Java
 * int instead of drifting into floating point. A collision merely skips one
 * frame, which is why this is good enough here and SHA-1 is not needed.
 */
export function quickHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * MULTIPLIER + input.charCodeAt(i)) | 0
  }

  return `${input.length}:${hash}`
}
