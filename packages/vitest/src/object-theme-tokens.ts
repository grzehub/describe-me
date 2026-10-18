import type { FoundationGroup, FoundationToken } from '@describe-me/core/types'
import { isCssColor } from './is-css-color.js'
import { splitLightDark } from './split-light-dark.js'

/** Deeper values are not read, so a theme with a huge nested object cannot stall the run. */
const MAX_DEPTH = 8

/** More tokens than any design system has: past it, the export is likely not a theme. */
const MAX_TOKENS = 2000

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'cursive',
  'fantasy',
])

const DURATION = /^(?:\d+|\d*\.\d+)m?s$/

const LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw|vmin|vmax|ch|ex|pt)$/

/** Path keywords that pick the group of a length, checked in this order. */
const LENGTH_GROUPS: [FoundationGroup, string[]][] = [
  ['radius', ['radius', 'radii', 'rounded']],
  ['breakpoints', ['breakpoint', 'screen', 'media']],
  ['typography', ['fontsize', 'letterspacing', 'lineheight']],
]

/** The tokens of a plain theme object, and whether it had more than the cap. */
export interface ObjectThemeTokens {
  tokens: FoundationToken[]
  truncated: boolean
}

type Classified = Pick<FoundationToken, 'group' | 'type' | 'modes'>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype: unknown = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

/** Splits at a separator outside parentheses, so `rgb(0 0 0 / 0.1)` stays one part. */
function splitOutsideParentheses(value: string, separator: ',' | ' '): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (depth === 0 && (char === separator || (separator === ' ' && /\s/.test(char)))) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }

  parts.push(value.slice(start))

  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

function isLength(value: string): boolean {
  return value === '0' || LENGTH.test(value)
}

/** Every layer has at least two lengths and a color, as in `0 1px 2px rgb(0 0 0 / 0.2)`. */
function isShadowValue(value: string): boolean {
  const layers = splitOutsideParentheses(value, ',')

  return (
    layers.length > 0 &&
    layers.every((layer) => {
      const words = splitOutsideParentheses(layer, ' ')

      return words.filter(isLength).length >= 2 && words.some(isCssColor)
    })
  )
}

function namesGenericFamily(value: string): boolean {
  return splitOutsideParentheses(value, ',').some((family) =>
    GENERIC_FAMILIES.has(family.toLowerCase()),
  )
}

function lengthGroup(segments: string[]): FoundationGroup {
  for (const [group, keywords] of LENGTH_GROUPS) {
    if (segments.some((segment) => keywords.some((keyword) => segment.includes(keyword)))) {
      return group
    }
  }

  return 'spacing'
}

/** By the value first, then by the path. */
function classifyString(value: string, segments: string[]): Classified {
  const modes = splitLightDark(value)

  if (modes !== null) {
    return { group: 'colors', type: 'color', modes }
  }

  if (isCssColor(value)) {
    return { group: 'colors', type: 'color' }
  }

  if (isShadowValue(value)) {
    return { group: 'shadows', type: 'shadow' }
  }

  if (namesGenericFamily(value)) {
    return { group: 'typography', type: 'fontFamily' }
  }

  if (DURATION.test(value)) {
    return { group: 'motion', type: 'duration' }
  }

  if (value.includes('cubic-bezier(') || value.includes('steps(')) {
    return { group: 'motion', type: 'cubicBezier' }
  }

  if (isLength(value)) {
    return { group: lengthGroup(segments), type: 'dimension' }
  }

  if (segments.some((segment) => segment.includes('shadow'))) {
    return { group: 'shadows', type: 'shadow' }
  }

  const last = segments.at(-1) ?? ''
  const parent = segments.at(-2)

  if (last.endsWith('fontfamily') || last === 'fonts' || parent === 'fonts') {
    return { group: 'typography', type: 'fontFamily' }
  }

  return { group: 'other' }
}

function classifyNumber(segments: string[]): Classified {
  if (segments.some((segment) => segment.includes('fontweight'))) {
    return { group: 'typography', type: 'fontWeight' }
  }

  if (segments.some((segment) => segment.includes('lineheight'))) {
    return { group: 'typography', type: 'number' }
  }

  return { group: 'other', type: 'number' }
}

function tokenOf(path: string[], value: string | number): FoundationToken {
  const segments = path.map((segment) => segment.toLowerCase())
  const text = typeof value === 'number' ? String(value) : value.trim()
  const classified =
    typeof value === 'number' ? classifyNumber(segments) : classifyString(text, segments)

  return {
    name: path.join('.'),
    group: classified.group,
    ...(classified.type === undefined ? {} : { type: classified.type }),
    value: classified.modes?.light ?? text,
    ...(classified.modes === undefined ? {} : { modes: classified.modes }),
    origin: 'project',
    source: 'theme',
  }
}

/**
 * The tokens of a plain theme object, one per string or number, named by its
 * dotted path (`colors.ink`, arrays by index) and grouped by its value, then
 * its path. A `light-dark()` value is read as light and dark.
 */
export function objectThemeTokens(theme: object): ObjectThemeTokens {
  const result: ObjectThemeTokens = { tokens: [], truncated: false }
  // The objects on the current path, so a cycle stops while a shared object is read at every path.
  const ancestors = new WeakSet<object>()

  const visit = (value: unknown, path: string[]): void => {
    if (result.truncated) {
      return
    }

    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
      if (result.tokens.length === MAX_TOKENS) {
        result.truncated = true
        return
      }

      result.tokens.push(tokenOf(path, value))
      return
    }

    const container = Array.isArray(value) || isPlainObject(value)

    if (!container || path.length >= MAX_DEPTH || ancestors.has(value)) {
      return
    }

    ancestors.add(value)

    for (const [key, child] of Object.entries(value)) {
      visit(child, [...path, key])
    }

    ancestors.delete(value)
  }

  visit(theme, [])

  return result
}
