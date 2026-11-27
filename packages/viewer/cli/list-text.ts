/** `a`, `a and b`, `a, b and c`. */
export function listText(parts: string[]): string {
  if (parts.length <= 1) {
    return parts.join('')
  }

  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
