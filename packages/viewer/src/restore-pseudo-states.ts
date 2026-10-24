import { PSEUDO_STATES_ATTRIBUTE } from '@describe-me/core/types'
import { stateClassSelector } from './state-class-selector.js'

type FrameView = Window & typeof globalThis

const STATES = new Set(['hover', 'focus', 'focus-visible', 'focus-within'])

// Chromium's own ring, from its html.css. Firefox drops a declaration with
// `-webkit-focus-ring-color`, so a plain one comes first. The first layer
// declared loses to every page rule, layered or not, as the UA origin does.
// Without the layer the ring would beat Tailwind's `outline-none` in
// `@layer utilities`, and paint where the test showed none.
const DEFAULT_RING = `@layer {
  :where(.\\:focus-visible) {
    outline: auto 1px;
    outline: auto 1px -webkit-focus-ring-color;
  }
  :where(input.\\:focus-visible, textarea.\\:focus-visible, select.\\:focus-visible) {
    outline-offset: 0;
  }
}`

// A second pass would wrap each `:is()` again.
const rewritten = new WeakSet<CSSStyleSheet>()

/** A sheet from another origin throws on `cssRules`, so it keeps its real pseudo-classes. */
function rulesOf(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules
  } catch {
    return null
  }
}

/** The rules come from the frame's realm, so only its own constructors match them. */
function rewriteRules(rules: CSSRuleList, view: FrameView): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof view.CSSStyleRule) {
      const selector = stateClassSelector(rule.selectorText)

      if (selector !== rule.selectorText) {
        rule.selectorText = selector
      }
    }

    if (rule instanceof view.CSSImportRule) {
      if (rule.styleSheet !== null) {
        rewriteSheet(rule.styleSheet, view)
      }
    } else if ('cssRules' in rule) {
      rewriteRules((rule as CSSGroupingRule).cssRules, view)
    }
  }
}

function rewriteSheet(sheet: CSSStyleSheet, view: FrameView): void {
  if (rewritten.has(sheet)) {
    return
  }

  const rules = rulesOf(sheet)

  if (rules === null) {
    return
  }

  rewritten.add(sheet)
  rewriteRules(rules, view)
}

/** The preview head's stylesheets are still loading when the frame is built. */
function rewriteWhenLoaded(doc: Document, view: FrameView): void {
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')) {
    if (link.sheet !== null) {
      continue
    }

    link.addEventListener(
      'load',
      () => {
        if (link.sheet !== null) {
          rewriteSheet(link.sheet, view)
        }
      },
      { once: true },
    )
  }
}

function addStateClasses(marked: NodeListOf<Element>): void {
  for (const element of marked) {
    const names = (element.getAttribute(PSEUDO_STATES_ATTRIBUTE) ?? '').split(' ')

    for (const name of names) {
      if (STATES.has(name)) {
        element.classList.add(`:${name}`)
      }
    }
  }
}

function insertDefaultRing(doc: Document): void {
  const style = doc.createElement('style')

  style.textContent = DEFAULT_RING
  doc.head?.prepend(style)
}

/**
 * Give a replayed frame the hover and focus its snapshot recorded. Each
 * marked element gets the classes `:hover`, `:focus`, `:focus-visible` and
 * `:focus-within` for the states it had, and each rule of the frame's sheets
 * that names a state matches the class as well, nested rules included. The
 * real states still match, so a pointer over the frame works as before. A
 * frame without states, such as one recorded before 0.12, stays as rrweb
 * built it.
 */
export function restorePseudoStates(doc: Document): void {
  const marked = doc.querySelectorAll(`[${PSEUDO_STATES_ATTRIBUTE}]`)
  const view = doc.defaultView

  if (marked.length === 0 || view === null) {
    return
  }

  addStateClasses(marked)

  for (const sheet of Array.from(doc.styleSheets)) {
    rewriteSheet(sheet, view)
  }

  rewriteWhenLoaded(doc, view)
  insertDefaultRing(doc)
}
