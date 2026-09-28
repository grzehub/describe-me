import { fontFamilyList } from './font-family-list.js'

/** A top-level token of a `font` value and where it starts. */
interface Token {
  text: string
  start: number
}

/** Values that set the whole shorthand and name no family. */
const KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'caption',
  'icon',
  'menu',
  'message-box',
  'small-caption',
  'status-bar',
])

const SIZE_KEYWORDS = new Set([
  'xx-small',
  'x-small',
  'small',
  'medium',
  'large',
  'x-large',
  'xx-large',
  'xxx-large',
  'smaller',
  'larger',
])

const LENGTH_UNITS = new Set([
  '%',
  'px',
  'em',
  'rem',
  'ex',
  'rex',
  'ch',
  'rch',
  'cap',
  'rcap',
  'ic',
  'ric',
  'lh',
  'rlh',
  'vw',
  'vh',
  'vi',
  'vb',
  'vmin',
  'vmax',
  'svw',
  'svh',
  'svi',
  'svb',
  'svmin',
  'svmax',
  'lvw',
  'lvh',
  'lvi',
  'lvb',
  'lvmin',
  'lvmax',
  'dvw',
  'dvh',
  'dvi',
  'dvb',
  'dvmin',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
  'cm',
  'mm',
  'q',
  'in',
  'pt',
  'pc',
])

const SIZE_FUNCTIONS = ['calc(', 'clamp(', 'min(', 'max(']

const NUMBER = /^[+-]?(?:\d+|\d*\.\d+)$/

const UNIT_CHARACTER = /[a-z%]/i

const WHITESPACE = /\s/

function commentEnd(value: string, open: number): number {
  const close = value.indexOf('*/', open + 2)

  return close === -1 ? value.length : close + 2
}

function stringEnd(value: string, open: number): number {
  let index = open + 1

  while (index < value.length && value[index] !== value[open]) {
    index += value[index] === '\\' ? 2 : 1
  }

  return index + 1
}

/** Top-level tokens split at whitespace, with `/` as a token of its own. */
function tokensOf(value: string): Token[] {
  const tokens: Token[] = []
  let current: Token | null = null
  let depth = 0
  let index = 0

  const close = () => {
    if (current !== null) {
      tokens.push(current)
      current = null
    }
  }

  while (index < value.length) {
    const char = value[index]

    if (char === '/' && value[index + 1] === '*') {
      close()
      index = commentEnd(value, index)
      continue
    }

    if (depth === 0 && (WHITESPACE.test(char) || char === '/')) {
      close()
      if (char === '/') {
        tokens.push({ text: '/', start: index })
      }

      index++
      continue
    }

    let next = index + 1
    if (char === '\\') {
      next = index + 2
    } else if (char === '"' || char === "'") {
      next = stringEnd(value, index)
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    }

    current ??= { text: '', start: index }
    current.text += value.slice(index, next)
    index = next
  }

  close()

  return tokens
}

function isDimension(token: string): boolean {
  let end = token.length
  while (end > 0 && UNIT_CHARACTER.test(token[end - 1])) {
    end--
  }

  const unit = token.slice(end).toLowerCase()

  return NUMBER.test(token.slice(0, end)) && LENGTH_UNITS.has(unit)
}

/** A bare number (`600`) is a weight and an angle is no size, so `font: 0/0 a` has none. */
function isSize(token: string): boolean {
  const lower = token.toLowerCase()

  return (
    SIZE_KEYWORDS.has(lower) ||
    SIZE_FUNCTIONS.some((name) => lower.startsWith(name)) ||
    isDimension(token)
  )
}

/**
 * The family list of a `font` shorthand value, such as `Inter` and
 * `sans-serif` for `600 14px/1.5 Inter, sans-serif`. Null when the value is a
 * keyword or has no size followed by a family.
 */
export function fontShorthandFamilies(value: string): string[] | null {
  if (KEYWORDS.has(value.trim().toLowerCase())) {
    return null
  }

  const tokens = tokensOf(value)
  const size = tokens.findIndex((token) => isSize(token.text))
  if (size === -1) {
    return null
  }

  const first = tokens[size + 1]?.text === '/' ? size + 3 : size + 1
  if (first >= tokens.length) {
    return null
  }

  const families = fontFamilyList(value.slice(tokens[first].start))

  return families.length > 0 ? families : null
}
