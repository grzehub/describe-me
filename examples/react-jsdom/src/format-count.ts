/** A count followed by its noun, singular only for exactly one: `1 item`, `3 items`. */
export function formatCount(count: number, noun: string): string {
  if (count === 1) {
    return `${count} ${noun}`
  }

  return `${count} ${noun}s`
}
