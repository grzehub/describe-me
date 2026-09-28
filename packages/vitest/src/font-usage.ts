import { cssReferences } from '@describe-me/core/css-references'
import { fontFamilyList } from './font-family-list.js'
import { fontShorthandFamilies } from './font-shorthand-families.js'

/** A `var()` in the place of a family. */
export interface FontVarReference {
  /** The custom property, such as `--font-body`. */
  name: string
  /** The text after its first comma, when there is one. */
  fallback?: string
}

/** What a stylesheet or a `style` attribute says about fonts. */
export interface FontUsage {
  /** The first family of each `font-family` and `font` declaration, unless it is a `var()`. */
  families: string[]
  /** Each `var()` in the place of a first family. */
  varRefs: FontVarReference[]
  /** Every custom property definition, in source order. */
  variables: Map<string, string[]>
  /** The families of `@font-face` rules. */
  declared: string[]
  /** `@import` targets as written. */
  imports: string[]
}

/** A stretch of CSS up to a `{`, `}` or `;` outside comments, strings, escapes and parentheses. */
interface Piece {
  text: string
  end: string
}

const IMPORTANT = /!\s*important\s*$/i

function commentEnd(css: string, open: number): number {
  const close = css.indexOf('*/', open + 2)

  return close === -1 ? css.length : close + 2
}

function stringEnd(css: string, open: number): number {
  let index = open + 1

  while (index < css.length && css[index] !== css[open]) {
    index += css[index] === '\\' ? 2 : 1
  }

  return index + 1
}

function piecesOf(css: string): Piece[] {
  const pieces: Piece[] = []
  let text = ''
  let copied = 0
  let parens = 0
  let index = 0

  while (index < css.length) {
    const char = css[index]

    if (char === '/' && css[index + 1] === '*') {
      text += `${css.slice(copied, index)} `
      index = commentEnd(css, index)
      copied = index
    } else if (char === '\\') {
      index += 2
    } else if (char === '"' || char === "'") {
      index = stringEnd(css, index)
    } else if (char === '(') {
      parens++
      index++
    } else if (char === ')') {
      parens = Math.max(0, parens - 1)
      index++
    } else if (parens === 0 && (char === '{' || char === '}' || char === ';')) {
      pieces.push({ text: text + css.slice(copied, index), end: char })
      text = ''
      index++
      copied = index
    } else {
      index++
    }
  }

  pieces.push({ text: text + css.slice(copied), end: '' })

  return pieces
}

/** `var(--x)` or `var(--x, fallback)` as a whole, or null. */
function varReference(text: string): FontVarReference | null {
  if (text.slice(0, 4).toLowerCase() !== 'var(' || !text.endsWith(')')) {
    return null
  }

  const inner = text.slice(4, -1)
  let depth = 0
  let comma = -1

  for (let i = 0; i < inner.length && comma === -1; i++) {
    if (inner[i] === '(') {
      depth++
    } else if (inner[i] === ')') {
      depth--
    } else if (inner[i] === ',' && depth === 0) {
      comma = i
    }

    // A `)` that closes `var(` before the end: `var(--a) var(--b)` is no single reference.
    if (depth < 0) {
      return null
    }
  }

  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim()
  if (!name.startsWith('--')) {
    return null
  }

  const fallback = comma === -1 ? '' : inner.slice(comma + 1).trim()

  return fallback === '' ? { name } : { name, fallback }
}

function addFamily(usage: FontUsage, family: string | undefined): void {
  if (family === undefined) {
    return
  }

  const reference = varReference(family)
  if (reference) {
    usage.varRefs.push(reference)
  } else {
    usage.families.push(family)
  }
}

function addFontShorthand(usage: FontUsage, value: string): void {
  const reference = varReference(value)
  if (reference) {
    usage.varRefs.push(reference)
    return
  }

  addFamily(usage, fontShorthandFamilies(value)?.[0])
}

function addDeclaration(usage: FontUsage, text: string, inFontFace: boolean): void {
  const colon = text.indexOf(':')
  if (colon === -1) {
    return
  }

  const property = text.slice(0, colon).trim()
  const name = property.toLowerCase()
  const value = text
    .slice(colon + 1)
    .trim()
    .replace(IMPORTANT, '')
    .trim()

  if (inFontFace) {
    if (name === 'font-family') {
      usage.declared.push(...fontFamilyList(value).slice(0, 1))
    }

    return
  }

  if (property.startsWith('--')) {
    usage.variables.set(property, [...(usage.variables.get(property) ?? []), value])
  } else if (name === 'font-family') {
    addFamily(usage, fontFamilyList(value)[0])
  } else if (name === 'font') {
    addFontShorthand(usage, value)
  }
}

/**
 * The fonts that CSS text uses, defines as custom properties, declares with
 * `@font-face` and imports. Reads a stylesheet or the bare text of a `style`
 * attribute. Only `font-family`, `font` and custom properties count.
 */
export function fontUsage(css: string): FontUsage {
  const usage: FontUsage = {
    families: [],
    varRefs: [],
    variables: new Map(),
    declared: [],
    imports: cssReferences(css)
      .filter((reference) => reference.kind === 'import')
      .map((reference) => reference.url),
  }

  // One entry per open block: whether it is, or sits inside, an `@font-face`.
  const fontFace: boolean[] = []

  for (const piece of piecesOf(css)) {
    const inFontFace = fontFace.at(-1) ?? false

    if (piece.end === '{') {
      fontFace.push(inFontFace || piece.text.trim().toLowerCase() === '@font-face')
      continue
    }

    addDeclaration(usage, piece.text, inFontFace)

    if (piece.end === '}') {
      fontFace.pop()
    }
  }

  return usage
}
