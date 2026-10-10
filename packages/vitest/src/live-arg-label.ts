const MAX_LENGTH = 80

function cut(text: string): string {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text
}

/** A DOM event, or one of React's synthetic events, which carry the native one. */
function isEvent(value: object): value is { type: string } {
  if (value instanceof Event) {
    return true
  }

  return 'nativeEvent' in value && typeof (value as { type?: unknown }).type === 'string'
}

/**
 * A short label for one argument of a mock call, such as `"Rename"`,
 * `click event`, `<button>` or `ƒ onClose`, for the viewer's list of actions.
 */
export function liveArgLabel(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(cut(value))
  }

  if (typeof value === 'function') {
    return `ƒ ${value.name || 'anonymous'}`
  }

  if (typeof value !== 'object' || value === null) {
    return String(value)
  }

  if (isEvent(value)) {
    return `${value.type} event`
  }

  if (value instanceof Element) {
    return `<${value.tagName.toLowerCase()}>`
  }

  try {
    return cut(JSON.stringify(value))
  } catch {
    return Array.isArray(value) ? '[…]' : '{…}'
  }
}
