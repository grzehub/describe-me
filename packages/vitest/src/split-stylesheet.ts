/**
 * A chunk is never closed before it holds this many characters, so a run of
 * small rules does not turn into a run of tiny files.
 */
const MIN_CHUNK = 1024

/**
 * A chunk is closed as soon as it holds this many characters, so no file grows
 * without bound. Only its last rule can take it past the limit: a rule is never
 * split.
 */
const MAX_CHUNK = 16384

/**
 * Past `MIN_CHUNK`, a rule of `n` characters closes its chunk when a hash of its
 * text says so, which happens for about `n` in `BOUNDARY_SPACING` rules. Chunks
 * then average about 4 KB, and where they end depends on the rules, not on
 * their offsets.
 */
const BOUNDARY_SPACING = 3072

/** 32-bit FNV-1a over UTF-16 code units: cheap, and the same for the same text on every run. */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }

  return hash >>> 0
}

/** Whether a top-level rule closes the chunk it ends, once the chunk is long enough. */
function isBoundary(piece: string): boolean {
  return fnv1a32(piece) % BOUNDARY_SPACING < piece.length
}

/** Index just past the comment that starts at `start`, or the end of the text when it is never closed. */
function endOfComment(css: string, start: number): number {
  const close = css.indexOf('*/', start + 2)

  return close === -1 ? css.length : close + 2
}

/** Index just past the string that starts at `start`, or the end of the text when it is never closed. */
function endOfString(css: string, start: number): number {
  const quote = css[start]
  let i = start + 1
  while (i < css.length) {
    if (css[i] === '\\') {
      i += 2
    } else if (css[i] === quote) {
      return i + 1
    } else {
      i++
    }
  }

  return css.length
}

/**
 * Cut a stylesheet right after every top-level rule: after a `}` that brings the
 * brace depth back to 0, or after a `;` at depth 0 (`@import`, `@charset`).
 * Strings, comments and backslash escapes are skipped, and nothing inside
 * parentheses counts, so `content: "}"`, `url(data:…;…)` and the `;` of an
 * unquoted font URL never end a rule. Whitespace and comments between rules,
 * rrweb's `rr_split` markers included, open the next piece; whatever follows
 * the last rule is the last piece.
 */
function topLevelPieces(css: string): string[] {
  const pieces: string[] = []
  let start = 0
  let braces = 0
  let parens = 0
  let i = 0

  while (i < css.length) {
    const char = css[i]

    if (char === '\\') {
      i += 2
      continue
    }

    if (char === '/' && css[i + 1] === '*') {
      i = endOfComment(css, i)
      continue
    }

    if (char === '"' || char === "'") {
      i = endOfString(css, i)
      continue
    }

    if (char === '(') {
      parens++
    } else if (char === ')') {
      parens = Math.max(0, parens - 1)
    } else if (parens === 0 && char === '{') {
      braces++
    } else if (parens === 0 && char === '}') {
      braces = Math.max(0, braces - 1)
    }

    i++

    if (parens === 0 && braces === 0 && (char === '}' || char === ';')) {
      pieces.push(css.slice(start, i))
      start = i
    }
  }

  if (start < css.length) {
    pieces.push(css.slice(start))
  }

  return pieces
}

/**
 * Split a stylesheet into chunks of about 4 KB for content-addressed storage.
 * A chunk only ever ends between two top-level rules, where the rule's content
 * decides, so inserting a rule leaves every chunk before it and most chunks
 * after it unchanged: a sheet that grows from test to test shares most of its
 * chunks with the previous version. `chunks.join('')` is always the input,
 * byte for byte, even when the CSS is malformed.
 */
export function splitStylesheet(css: string): string[] {
  const chunks: string[] = []
  let current = ''

  for (const piece of topLevelPieces(css)) {
    current += piece
    if (current.length >= MAX_CHUNK || (current.length >= MIN_CHUNK && isBoundary(piece))) {
      chunks.push(current)
      current = ''
    }
  }

  if (current !== '') {
    chunks.push(current)
  }

  return chunks
}
