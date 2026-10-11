const CYCLE_MESSAGES = ['circular structure', 'cyclic structures', 'cyclic object']

function formatString(value: unknown, inspect: (value: unknown) => string): string {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`
  }

  if (typeof value === 'number' && value === 0 && 1 / value < 0) {
    return '-0'
  }

  if (typeof value === 'object' && value !== null) {
    const { toString } = value as { toString?: unknown }

    if (typeof toString === 'function' && toString !== Object.prototype.toString) {
      return String(toString.call(value))
    }

    return inspect(value)
  }

  return String(value)
}

function formatJson(value: unknown): string {
  try {
    return String(JSON.stringify(value))
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (CYCLE_MESSAGES.some((cycle) => message.includes(cycle))) {
      return '[Circular]'
    }

    throw error
  }
}

/** What `format` appends for an argument no placeholder took. */
function appended(value: unknown, inspect: (value: unknown) => string): string {
  if (value === null || typeof value !== 'object') {
    return ` ${String(value)}`
  }

  return ` ${inspect(value)}`
}

/**
 * Vitest's `format([placeholder, value])`, which `formatTitle` calls for each
 * placeholder of an `each` or `for` name with the next row value. `%%` takes
 * a value too, so it prints `%`, a space and that value.
 */
export function liveFormatPlaceholder(
  placeholder: string,
  value: unknown,
  inspect: (value: unknown) => string,
): string {
  switch (placeholder) {
    case '%%':
      return `%${appended(value, inspect)}`
    case '%s':
      return formatString(value, inspect)
    case '%d':
      if (typeof value === 'bigint') {
        return `${value.toString()}n`
      }

      return typeof value === 'symbol' ? 'NaN' : Number(value).toString()
    case '%i':
      if (typeof value === 'bigint') {
        return `${value.toString()}n`
      }

      return Number.parseInt(String(value)).toString()
    case '%f':
      return Number.parseFloat(String(value)).toString()
    case '%o':
    case '%O':
      return inspect(value)
    case '%c':
      return ''
    case '%j':
      return formatJson(value)
    default:
      return placeholder
  }
}
