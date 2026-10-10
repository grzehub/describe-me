const PLACEHOLDER = /%[sdi#%]/g
const KEY = /\$([\w$]+(?:\.[\w$]+)*)/g

function valueAt(row: unknown, key: string): unknown {
  let value = row

  for (const part of key.split('.')) {
    if (typeof value !== 'object' || value === null) {
      return undefined
    }

    value = (value as Record<string, unknown>)[part]
  }

  return value
}

function shown(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value !== 'object' || value === null) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function fillPlaceholders(template: string, items: unknown[], index: number): string {
  let next = 0

  return template.replace(PLACEHOLDER, (token) => {
    if (token === '%%') {
      return '%'
    }

    if (token === '%#') {
      return String(index)
    }

    const value = items[next]
    next += 1

    if (token === '%s') {
      return shown(value)
    }

    if (token === '%d') {
      return String(Number(value))
    }

    return String(Math.trunc(Number(value)))
  })
}

/**
 * The name of one row of `each` or `for`, with `%s`, `%d`, `%i`, `%#`, `%%`
 * and `$key` filled in. A simple stand-in for Vitest's formatter, which
 * prints some values differently.
 */
export function liveEachName(template: string, items: unknown[], index: number): string {
  const named = fillPlaceholders(template, items, index)
  const [first] = items

  if (typeof first !== 'object' || first === null) {
    return named
  }

  return named.replace(KEY, (match, key: string) => {
    const value = valueAt(first, key)

    return value === undefined ? match : shown(value)
  })
}
