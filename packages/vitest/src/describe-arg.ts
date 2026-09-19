import { prettySelector } from './pretty-selector.js'

/** Render one argument of a `userEvent.*` call for the frame label. */
export function describeArg(arg: unknown): string {
  if (arg == null) return ''
  if (typeof arg === 'string') return JSON.stringify(arg)
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
  if (typeof arg === 'object') {
    const o = arg as { selector?: string; tagName?: string; textContent?: string | null }
    if (typeof o.selector === 'string') return prettySelector(o.selector)
    if (typeof o.tagName === 'string') {
      const text = (o.textContent ?? '').trim().slice(0, 24)
      return `<${o.tagName.toLowerCase()}>${text ? ` "${text}"` : ''}`
    }
    const json = JSON.stringify(arg)
    return json.length <= 32 ? json : '{…}'
  }
  return String(arg)
}
