const WHITESPACE = /\s+/g

function commentEnd(value: string, open: number): number {
  const close = value.indexOf('*/', open + 2)

  return close === -1 ? value.length : close + 2
}

/** The unescaped text of the string opening at `open`, and where scanning goes on. */
function readString(value: string, open: number): { text: string; next: number } {
  let text = ''
  let index = open + 1

  while (index < value.length && value[index] !== value[open]) {
    if (value[index] === '\\') {
      text += value[index + 1] ?? ''
      index += 2
      continue
    }

    text += value[index]
    index++
  }

  return { text, next: index + 1 }
}

/**
 * The names in a `font-family` value, unquoted, with their whitespace
 * collapsed. Commas inside quotes or parentheses do not split, so
 * `"Foo, Bar", serif` gives `Foo, Bar` and `serif`, and a `var()` stays whole.
 */
export function fontFamilyList(value: string): string[] {
  const names: string[] = []
  let current = ''
  let depth = 0
  let index = 0

  while (index < value.length) {
    const char = value[index]

    if (char === '/' && value[index + 1] === '*') {
      current += ' '
      index = commentEnd(value, index)
      continue
    }

    if (char === '\\') {
      current += depth > 0 ? value.slice(index, index + 2) : (value[index + 1] ?? '')
      index += 2
      continue
    }

    if ((char === '"' || char === "'") && depth === 0) {
      const string = readString(value, index)
      current += string.text
      index = string.next
      continue
    }

    if (char === ',' && depth === 0) {
      names.push(current)
      current = ''
      index++
      continue
    }

    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    }

    current += char
    index++
  }

  names.push(current)

  return names.map((name) => name.replace(WHITESPACE, ' ').trim()).filter((name) => name !== '')
}
