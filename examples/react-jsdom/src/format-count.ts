export function formatCount(count: number, noun: string): string {
  if (count === 1) {
    return `${count} ${noun}`
  }

  return `${count} ${noun}s`
}
