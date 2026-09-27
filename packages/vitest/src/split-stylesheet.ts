/** A chunk is never closed below this length, so small rules do not end up in tiny files. */
const MIN_CHUNK = 1024

/**
 * A chunk is closed once it reaches this length. Only its last rule can take it
 * past the limit, because a rule is never split.
 */
const MAX_CHUNK = 16384

/**
 * Past `MIN_CHUNK`, a rule of `n` characters ends its chunk with a probability
 * of about `n / BOUNDARY_SPACING`, decided by a hash of its text. Chunks then
 * average about 4 KB, and where they end depends on content, not on offsets.
 */
const BOUNDARY_SPACING = 3072

/** Boundaries only need a cheap, stable hash, not sha1. */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }

  return hash >>> 0
}

function isBoundary(piece: string): boolean {
  return fnv1a32(piece) % BOUNDARY_SPACING < piece.length
}

function endOfComment(css: string, start: number): number {
  const close = css.indexOf('*/', start + 2)

  return close === -1 ? css.length : close + 2
}

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
 * Cut a stylesheet after every top-level rule: after the `}` that closes a
 * top-level block, or after a semicolon at depth 0 (`@import`). Strings,
 * comments and escapes are skipped and nothing in parentheses counts, so
 * `content: "}"` or an unquoted font URL with semicolons never ends a rule.
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
 * Split a stylesheet into chunks of about 4 KB, cut between top-level rules
 * where their content decides, so a sheet that grows from test to test keeps
 * most of its chunks. `chunks.join('')` is always the input, even for
 * malformed CSS.
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
