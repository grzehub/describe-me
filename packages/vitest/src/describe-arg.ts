import { prettySelector } from './pretty-selector.js'

/** Render one argument of a `userEvent.*` call for the frame label. */
export function describeArg(arg: unknown): string {
  if (arg == null) {
    return ''
  }

  if (typeof arg === 'string') {
    return JSON.stringify(arg)
  }

  if (typeof arg === 'number' || typeof arg === 'boolean') {
    return String(arg)
  }

  if (typeof arg === 'object') {
    const candidate = arg as { selector?: string; tagName?: string; textContent?: string | null }
    if (typeof candidate.selector === 'string') {
      return prettySelector(candidate.selector)
    }

    if (typeof candidate.tagName === 'string') {
      const text = (candidate.textContent ?? '').trim().slice(0, 24)
      return `<${candidate.tagName.toLowerCase()}>${text ? ` "${text}"` : ''}`
    }

    const json = JSON.stringify(arg)
    return json.length <= 32 ? json : '{…}'
  }

  return String(arg)
}
