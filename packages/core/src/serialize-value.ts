/** Turn arbitrary props into something JSON-safe and readable. */
export function serializeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '…'
  if (value === null || value === undefined) return value
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (t === 'function') return `ƒ ${(value as Function).name || 'anonymous'}`
  if (t === 'symbol') return String(value)
  if (Array.isArray(value)) return value.map((v) => serializeValue(v, depth + 1))
  if (t === 'object') {
    const o = value as Record<string, unknown>
    // React element
    if ('$$typeof' in o && 'type' in o) {
      const type = o.type as unknown
      const name =
        typeof type === 'string'
          ? type
          : ((type as { displayName?: string; name?: string })?.displayName ??
            (type as { name?: string })?.name ??
            'Anonymous')
      return `<${name} />`
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) out[k] = serializeValue(v, depth + 1)
    return out
  }
  return String(value)
}
