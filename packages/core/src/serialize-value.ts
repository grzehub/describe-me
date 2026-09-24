import { describeComponentType } from './describe-component-type.js'

/** Turn arbitrary props into something JSON-safe and readable. */
export function serializeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return '…'
  }

  if (value === null || value === undefined) {
    return value
  }

  const kind = typeof value
  if (kind === 'string' || kind === 'number' || kind === 'boolean') {
    return value
  }

  if (kind === 'function') {
    return `ƒ ${(value as { name?: string }).name || 'anonymous'}`
  }

  if (kind === 'symbol') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, depth + 1))
  }

  if (kind === 'object') {
    const record = value as Record<string, unknown>
    // React element
    if ('$$typeof' in record && 'type' in record) {
      const { name } = describeComponentType(record.type)

      return `<${name} />`
    }

    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(record)) {
      out[key] = serializeValue(entry, depth + 1)
    }

    return out
  }

  return String(value)
}
