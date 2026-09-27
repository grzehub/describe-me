/** A `url()` or `@import` target in CSS text. */
export interface CssReference {
  /** The URL as written, without quotes or surrounding whitespace. */
  url: string
  /** Offset of the URL's first character in the scanned text. */
  start: number
  /** Offset just past the URL's last character. */
  end: number
  /** `import` for an `@import` target, written as a string or as `url()`. */
  kind: 'url' | 'import'
}

/** What a scan step found, and where scanning goes on. */
interface Scanned {
  reference: CssReference | null
  next: number
}

/** Where a scan step can start: a comment, a string, an escape, `@import` or `url(`. */
const TOKEN = /\/\*|["'\\]|@import|url\(/gi

const NAME_CHARACTER = /[\w\u0080-\uffff-]/

const WHITESPACE = /\s/

function isNameCharacter(char: string | undefined): boolean {
  return char !== undefined && NAME_CHARACTER.test(char)
}

function isQuote(char: string | undefined): boolean {
  return char === '"' || char === "'"
}

/** The offset of the quote that closes the string opening at `open`. A newline ends a broken string. */
function closingQuote(css: string, open: number): number {
  let index = open + 1

  while (index < css.length) {
    const char = css[index]
    if (char === '\\') {
      index += 2
      continue
    }

    if (char === css[open] || char === '\n') {
      return index
    }

    index++
  }

  return css.length
}

/** The offset just past the comment opening at `open`. */
function commentEnd(css: string, open: number): number {
  const close = css.indexOf('*/', open + 2)

  return close === -1 ? css.length : close + 2
}

function skipWhitespaceAndComments(css: string, start: number): number {
  let index = start

  while (index < css.length) {
    if (WHITESPACE.test(css[index])) {
      index++
    } else if (css.startsWith('/*', index)) {
      index = commentEnd(css, index)
    } else {
      break
    }
  }

  return index
}

/** `url(` at `index` as a function of its own, not the tail of a longer name such as `my-url(`. */
function isUrlFunction(css: string, index: number): boolean {
  return css.slice(index, index + 4).toLowerCase() === 'url(' && !isNameCharacter(css[index - 1])
}

function referenceOf(
  css: string,
  start: number,
  end: number,
  kind: CssReference['kind'],
): CssReference | null {
  if (end <= start) {
    return null
  }

  return { url: css.slice(start, end), start, end, kind }
}

/** The quoted string opening at `open`, as a reference. */
function scanString(css: string, open: number, kind: CssReference['kind']): Scanned {
  const close = closingQuote(css, open)

  return { reference: referenceOf(css, open + 1, close, kind), next: close + 1 }
}

/**
 * The target of the `url(` starting at `index`. An unquoted URL runs until the
 * first `)`, because a Google Fonts `css2` URL contains semicolons.
 */
function scanUrl(css: string, index: number, kind: CssReference['kind']): Scanned {
  let start = index + 'url('.length
  while (start < css.length && WHITESPACE.test(css[start])) {
    start++
  }

  if (isQuote(css[start])) {
    return scanString(css, start, kind)
  }

  const close = css.indexOf(')', start)
  if (close === -1) {
    return { reference: null, next: start }
  }

  let end = close
  while (end > start && WHITESPACE.test(css[end - 1])) {
    end--
  }

  return { reference: referenceOf(css, start, end, kind), next: close + 1 }
}

/** The target of the `@import` starting at `index`: a string or a `url()`. */
function scanImport(css: string, index: number): Scanned {
  const target = skipWhitespaceAndComments(css, index + '@import'.length)

  if (isQuote(css[target])) {
    return scanString(css, target, 'import')
  }

  if (isUrlFunction(css, target)) {
    return scanUrl(css, target, 'import')
  }

  return { reference: null, next: target }
}

function scanToken(css: string, index: number, token: string): Scanned {
  const skipped = (next: number): Scanned => ({ reference: null, next })

  if (token === '/*') {
    return skipped(commentEnd(css, index))
  }

  if (token === '\\') {
    return skipped(index + 2)
  }

  if (isQuote(token)) {
    return skipped(closingQuote(css, index) + 1)
  }

  if (token.startsWith('@')) {
    return isNameCharacter(css[index + token.length]) ? skipped(index + 1) : scanImport(css, index)
  }

  return isUrlFunction(css, index) ? scanUrl(css, index, 'url') : skipped(index + 1)
}

/**
 * Every `url()` and `@import` target in CSS text, in source order, remote,
 * `data:` and `#fragment` URLs included. Comments and other strings are
 * skipped, so `content: "url(x)"` yields nothing.
 */
export function cssReferences(cssText: string): CssReference[] {
  const references: CssReference[] = []
  const token = new RegExp(TOKEN)
  let match = token.exec(cssText)

  while (match !== null) {
    const scanned = scanToken(cssText, match.index, match[0])
    if (scanned.reference) {
      references.push(scanned.reference)
    }

    token.lastIndex = scanned.next
    match = token.exec(cssText)
  }

  return references
}
