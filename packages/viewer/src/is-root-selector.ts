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

/**
 * Whether one selector of a list is root-like: a compound of `:root`, `:host`,
 * a leading `html`, `.dark`, `.light` and `[data-*]`, with no combinator, such
 * as `:root`, `html.dark` or `[data-theme="dark"]`. A twin of the rule in
 * packages/vitest/src/root-custom-properties.ts, which picks the token sheets.
 */
export function isRootSelector(selector: string): boolean {
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
