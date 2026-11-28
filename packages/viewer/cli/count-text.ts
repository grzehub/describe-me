/** `1 test`, `2 tests`: a number with its noun. */
export function countText(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}
