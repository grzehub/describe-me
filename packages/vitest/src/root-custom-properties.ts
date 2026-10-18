/** The keywords a root-like compound may hold, each matched as a whole word. */
const ROOT_KEYWORDS = [':root', ':host', '.dark', '.light']

/** `data-name`, `data-name=value`, `data-name="value"` or `data-name='value'`, inside `[…]`. */
const DATA_ATTRIBUTE = /^\s*data-[\w-]+\s*(?:=\s*(?:"[^"]*"|'[^']*'|[\w-]+)\s*)?$/

/** A character that continues an identifier, an escape included, so `.dark\:bg-x` is not `.dark`. */
function continuesIdentifier(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }

  return /^[\w\\-]$/.test(char) || char.charCodeAt(0) > 0x7f
}

function wordAt(selector: string, at: number, word: string): boolean {
  return selector.startsWith(word, at) && !continuesIdentifier(selector[at + word.length])
}

/** The end of the simple selector at `at`, or -1 when it is not one a root-like compound allows. */
function endOfRootSimpleSelector(selector: string, at: number): number {
  if (at === 0 && wordAt(selector, at, 'html')) {
    return 'html'.length
  }

  for (const keyword of ROOT_KEYWORDS) {
    if (wordAt(selector, at, keyword)) {
      return at + keyword.length
    }
  }

  if (selector[at] !== '[') {
    return -1
  }

  const close = selector.indexOf(']', at)

  if (close === -1 || !DATA_ATTRIBUTE.test(selector.slice(at + 1, close))) {
    return -1
  }

  return close + 1
}

/** `:root`, `html.dark` or `[data-theme="dark"]`: a compound of root-like selectors, no combinator. */
function isRootCompound(selector: string): boolean {
  if (selector === '') {
    return false
  }

  let at = 0

  while (at < selector.length) {
    at = endOfRootSimpleSelector(selector, at)

    if (at === -1) {
      return false
    }
  }

  return true
}

function withoutComments(text: string): string {
  let result = ''
  let from = 0

  for (let open = text.indexOf('/*'); open !== -1; open = text.indexOf('/*', from)) {
    result += text.slice(from, open)
    const close = text.indexOf('*/', open + 2)
    from = close === -1 ? text.length : close + 2
  }

  return result + text.slice(from)
}

function isRootPrelude(prelude: string): boolean {
  const selectors = withoutComments(prelude).trim()

  if (selectors.startsWith('@')) {
    return false
  }

  return selectors.split(',').some((selector) => isRootCompound(selector.trim()))
}

/** The custom property a declaration sets, or undefined when it sets none. */
function customPropertyOf(declaration: string): string | undefined {
  const text = withoutComments(declaration).trimStart()

  if (!text.startsWith('--')) {
    return undefined
  }

  const colon = text.indexOf(':')
  const name = colon === -1 ? '' : text.slice(0, colon).trim()

  // `--` alone is reserved, and no property.
  return name.length > 2 ? name : undefined
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
 * The distinct custom properties a stylesheet declares directly on `:root`,
 * `:host`, `html`, `.dark`, `.light` or `[data-*]`, at any depth inside
 * at-rules, in order of first appearance. A single pass that skips comments,
 * strings and escapes, where nothing in parentheses ends a declaration. It
 * reads no values.
 */
export function rootCustomProperties(css: string): string[] {
  const names = new Set<string>()
  // One entry per open block: whether its prelude is root-like.
  const blocks: boolean[] = []
  let start = 0
  let parens = 0
  let i = 0

  const readDeclaration = (end: number) => {
    if (blocks.at(-1) !== true) {
      return
    }

    const name = customPropertyOf(css.slice(start, end))

    if (name !== undefined) {
      names.add(name)
    }
  }

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
      blocks.push(isRootPrelude(css.slice(start, i)))
      start = i + 1
    } else if (parens === 0 && (char === ';' || char === '}')) {
      readDeclaration(i)
      start = i + 1

      if (char === '}') {
        blocks.pop()
      }
    }

    i++
  }

  return [...names]
}
