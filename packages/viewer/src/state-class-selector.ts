const STATES = new Set(['hover', 'focus', 'focus-visible', 'focus-within'])

// `:focus` also finds `:focus-visible` and `:focus-within`.
const MAY_NAME_A_STATE = /:(?:hover|focus)/i
const NAME_CHAR = /[\w-]/

/** The index right after the quoted string that opens at `start`. */
function skipString(text: string, start: number): number {
  const quote = text[start]

  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
    } else if (text[i] === quote) {
      return i + 1
    }
  }

  return text.length
}

/** The index right after the attribute selector that opens at `start`, strings and escapes included. */
function skipAttribute(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i]

    if (char === '\\') {
      i++
    } else if (char === '"' || char === "'") {
      i = skipString(text, i) - 1
    } else if (char === ']') {
      return i + 1
    }
  }

  return text.length
}

/** Where scanning goes on after `start` when the character there opens an escape, a string or an attribute selector. */
function skipOpaque(text: string, start: number): number | null {
  const char = text[start]

  if (char === '\\') {
    return start + 2
  }

  if (char === '"' || char === "'") {
    return skipString(text, start)
  }

  return char === '[' ? skipAttribute(text, start) : null
}

/**
 * The selectors of a list, cut at its top-level commas. Unlike
 * `splitTopLevel()`, it skips strings, attribute selectors and escapes, so
 * `[title="a, b"]` and `.a\,b` stay whole.
 */
function splitSelectorList(list: string): string[] {
  const selectors: string[] = []
  let depth = 0
  let start = 0
  let i = 0

  while (i < list.length) {
    const skipped = skipOpaque(list, i)

    if (skipped !== null) {
      i = skipped
      continue
    }

    const char = list[i]

    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      selectors.push(list.slice(start, i).trim())
      start = i + 1
    }

    i++
  }

  selectors.push(list.slice(start).trim())

  return selectors
}

/** A backslash goes on with the identifier, so `:hover\:x` names no state. */
function isNameChar(char: string): boolean {
  return NAME_CHAR.test(char) || char === '\\' || char.charCodeAt(0) >= 0x80
}

/** The state that the pseudo-class name at `start` spells, in lower case, or `null`. */
function stateAt(selector: string, start: number): string | null {
  let end = start

  while (end < selector.length && isNameChar(selector[end])) {
    end++
  }

  const name = selector.slice(start, end).toLowerCase()

  return STATES.has(name) ? name : null
}

/**
 * One selector with each state turned into `:is(:state, .\:state)`, or the
 * selector unchanged when a state follows a pseudo-element. Only a few
 * pseudo-classes may follow one, never a class, and Chromium ignores a whole
 * `selectorText` when one selector of its list is invalid.
 */
function withStateClasses(selector: string): string {
  let rewritten = ''
  let copied = 0
  let afterPseudoElement = false
  let i = 0

  while (i < selector.length) {
    const skipped = skipOpaque(selector, i)

    if (skipped !== null) {
      i = skipped
      continue
    }

    if (selector[i] !== ':') {
      i++
      continue
    }

    if (selector[i + 1] === ':') {
      afterPseudoElement = true
      i += 2
      continue
    }

    const state = stateAt(selector, i + 1)

    if (state === null) {
      i++
      continue
    }

    if (afterPseudoElement) {
      return selector
    }

    rewritten += `${selector.slice(copied, i)}:is(:${state}, .\\:${state})`
    i += state.length + 1
    copied = i
  }

  return copied === 0 ? selector : rewritten + selector.slice(copied)
}

/**
 * A selector list that also matches the classes a replayed frame gives the
 * elements it recorded in a state: `.btn:hover` becomes
 * `.btn:is(:hover, .\:hover)`, also inside `:not()`, `:is()`, `:where()` and
 * `:has()`. Replaced in place, so a negation such as `:not(:focus-visible)`
 * reads the class too, and `:is()` keeps the specificity. Escaped colons, as
 * in `.hover\:bg-accent` or rrweb's `.\:hover` copies, stay as they are.
 * Returns `selectorList` itself when it names no state.
 */
export function stateClassSelector(selectorList: string): string {
  if (!MAY_NAME_A_STATE.test(selectorList)) {
    return selectorList
  }

  const selectors = splitSelectorList(selectorList)
  const rewritten = selectors.map(withStateClasses)

  if (rewritten.every((selector, index) => selector === selectors[index])) {
    return selectorList
  }

  return rewritten.join(', ')
}
