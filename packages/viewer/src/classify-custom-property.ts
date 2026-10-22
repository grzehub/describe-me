import type { FoundationGroup, FoundationTokenType } from '@describe-me/core/types'
import type { TypographyPartName } from './typography-part.js'
import { typographyPart } from './typography-part.js'

/** The section and type a custom property goes to. */
export interface CustomPropertyClass {
  group: FoundationGroup
  type?: FoundationTokenType
}

interface PrefixRule {
  prefix: string
  group: FoundationGroup
  type?: FoundationTokenType
}

interface WordRule {
  group: FoundationGroup
  words: string[]
  /** Two words in a row, such as `line height`. */
  pairs?: [string, string][]
}

/**
 * A copy of `PREFIX_RULES` in packages/vitest/src/tailwind-tokens.ts, checked
 * longest first, so `--text-shadow-` wins over `--text-`.
 */
const PREFIX_RULES: PrefixRule[] = (
  [
    { prefix: '--text-shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--inset-shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--drop-shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--color-', group: 'colors', type: 'color' },
    { prefix: '--font-weight-', group: 'typography', type: 'fontWeight' },
    { prefix: '--font-', group: 'typography', type: 'fontFamily' },
    { prefix: '--default-font-family', group: 'typography', type: 'fontFamily' },
    { prefix: '--default-mono-font-family', group: 'typography', type: 'fontFamily' },
    { prefix: '--default-font-', group: 'typography' },
    { prefix: '--default-mono-font-', group: 'typography' },
    { prefix: '--text-', group: 'typography', type: 'dimension' },
    { prefix: '--tracking-', group: 'typography', type: 'dimension' },
    { prefix: '--leading-', group: 'typography', type: 'number' },
    { prefix: '--spacing', group: 'spacing', type: 'dimension' },
    { prefix: '--radius-', group: 'radius', type: 'dimension' },
    { prefix: '--breakpoint-', group: 'breakpoints', type: 'dimension' },
    { prefix: '--container-', group: 'breakpoints', type: 'dimension' },
    { prefix: '--ease-', group: 'motion', type: 'cubicBezier' },
    { prefix: '--default-transition-timing-function', group: 'motion', type: 'cubicBezier' },
    { prefix: '--default-transition-duration', group: 'motion', type: 'duration' },
    { prefix: '--animate-', group: 'motion' },
  ] satisfies PrefixRule[]
).sort((left, right) => right.prefix.length - left.prefix.length)

/** In this order, so `letter-spacing` is typography before `spacing` is spacing. */
const WORD_RULES: WordRule[] = [
  { group: 'radius', words: ['radius', 'radii', 'rounded'] },
  { group: 'shadows', words: ['shadow', 'shadows', 'elevation'] },
  {
    group: 'typography',
    words: ['font', 'fonts', 'typography', 'leading', 'tracking'],
    pairs: [
      ['line', 'height'],
      ['letter', 'spacing'],
    ],
  },
  { group: 'breakpoints', words: ['breakpoint', 'breakpoints', 'screen', 'screens'] },
  {
    group: 'motion',
    words: [
      'duration',
      'easing',
      'ease',
      'transition',
      'transitions',
      'animation',
      'animate',
      'motion',
    ],
  },
  { group: 'spacing', words: ['spacing', 'space', 'gap'] },
]

const PART_TYPES: Record<Exclude<TypographyPartName, 'lineHeight'>, FoundationTokenType> = {
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
  fontSize: 'dimension',
  letterSpacing: 'dimension',
}

const CSS_WIDE_KEYWORDS = ['inherit', 'initial', 'unset', 'revert', 'revert-layer']
const MAX_DEPTH = 8
/** Bounds the work on references that fan out at every level. */
const MAX_SUBSTITUTIONS = 256
const DURATION = /^-?(?:\d+(?:\.\d+)?|\.\d+)m?s$/i
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/
const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g

/** The index of the `)` that closes the `(` at `open`, or -1. */
function closingParen(text: string, open: number): number {
  let depth = 0

  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') {
      depth++
    } else if (text[i] === ')') {
      depth--

      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

function topLevelComma(text: string): number {
  let depth = 0

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') {
      depth++
    } else if (text[i] === ')') {
      depth--
    } else if (text[i] === ',' && depth === 0) {
      return i
    }
  }

  return -1
}

/**
 * `value` with every `var()` replaced by the other property's light value, or
 * by its fallback when the name is unknown. Null when a reference cannot be
 * resolved within `MAX_DEPTH` levels.
 */
function substitute(
  value: string,
  others: ReadonlyMap<string, string>,
  depth: number,
  budget: { left: number },
): string | null {
  let result = ''
  let from = 0

  for (let at = value.indexOf('var(', from); at !== -1; at = value.indexOf('var(', from)) {
    const close = closingParen(value, at + 3)
    budget.left--

    if (close === -1 || depth >= MAX_DEPTH || budget.left < 0) {
      return null
    }

    const inner = value.slice(at + 4, close)
    const comma = topLevelComma(inner)
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim()
    const fallback = comma === -1 ? undefined : inner.slice(comma + 1).trim()
    const replacement = others.get(name) ?? fallback

    if (replacement === undefined) {
      return null
    }

    const resolved = substitute(replacement, others, depth + 1, budget)

    if (resolved === null) {
      return null
    }

    result += value.slice(from, at) + resolved
    from = close + 1
  }

  return result + value.slice(from)
}

function isColor(value: string, others: ReadonlyMap<string, string>): boolean {
  const text = value.trim()

  if (text.toLowerCase().startsWith('light-dark(')) {
    return true
  }

  const resolved = substitute(text, others, 0, { left: MAX_SUBSTITUTIONS })?.trim()

  if (!resolved || CSS_WIDE_KEYWORDS.includes(resolved.toLowerCase())) {
    return false
  }

  return CSS.supports('color', resolved)
}

/** A line height is a `number` when it resolves to one, such as `1.5`, and a `dimension` otherwise. */
function partType(
  part: TypographyPartName,
  value: string,
  others: ReadonlyMap<string, string>,
): FoundationTokenType {
  if (part === 'lineHeight') {
    const resolved = substitute(value.trim(), others, 0, { left: MAX_SUBSTITUTIONS })?.trim()

    return resolved !== undefined && NUMBER.test(resolved) ? 'number' : 'dimension'
  }

  return PART_TYPES[part]
}

/** `--fontSize-lg` as `['font', 'size', 'lg']`. */
function wordsOf(name: string): string[] {
  return name
    .replace(/^-+/, '')
    .replace(CAMEL_BOUNDARY, '$1-$2')
    .toLowerCase()
    .split('-')
    .filter((word) => word !== '')
}

function hasPair(words: string[], [first, second]: [string, string]): boolean {
  return words.some((word, i) => word === first && words[i + 1] === second)
}

function groupByWords(name: string): FoundationGroup | undefined {
  const words = wordsOf(name)
  const rule = WORD_RULES.find(
    (candidate) =>
      candidate.words.some((word) => words.includes(word)) ||
      (candidate.pairs ?? []).some((pair) => hasPair(words, pair)),
  )

  return rule?.group
}

/**
 * The section and type of a custom property, from its value, the typography
 * part its name holds, its name's prefix or its words. The part wins over the
 * prefix, so `--font-size-lg` is a size although Tailwind would read
 * `--font-*` as a family. `others` holds the light values of the other custom
 * properties, which `var()` references resolve to.
 */
export function classifyCustomProperty(
  name: string,
  value: string,
  others: ReadonlyMap<string, string>,
): CustomPropertyClass {
  if (isColor(value, others)) {
    return { group: 'colors', type: 'color' }
  }

  const part = typographyPart(name)?.part

  if (part) {
    return { group: 'typography', type: partType(part, value, others) }
  }

  const rule = PREFIX_RULES.find((candidate) => name.startsWith(candidate.prefix))

  if (rule) {
    return rule.type === undefined ? { group: rule.group } : { group: rule.group, type: rule.type }
  }

  const group = groupByWords(name)

  if (group) {
    return { group }
  }

  const text = value.trim()

  if (DURATION.test(text)) {
    return { group: 'motion', type: 'duration' }
  }

  if (text.startsWith('cubic-bezier(') || text.startsWith('steps(')) {
    return { group: 'motion', type: 'cubicBezier' }
  }

  return { group: 'other' }
}
