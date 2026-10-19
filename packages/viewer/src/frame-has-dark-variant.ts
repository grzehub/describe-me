import { detectDarkVariant } from './detect-dark-variant.js'
import { readCustomProperties } from './read-custom-properties.js'

const DARK_MEDIA = /prefers-color-scheme\s*:\s*dark/i

const known = new WeakMap<Document, boolean>()

/** A sheet from another origin throws on `cssRules`, so its rules stay unread. */
function rulesOf(sheet: CSSStyleSheet): CSSRule[] {
  try {
    return Array.from(sheet.cssRules)
  } catch {
    return []
  }
}

/**
 * The frame's dark scheme makes a `prefers-color-scheme: dark` rule match,
 * even without a custom property. The rules come from the frame's realm, so
 * only its own `CSSMediaRule` matches them.
 */
function hasDarkMedia(rules: Iterable<CSSRule>, view: typeof globalThis): boolean {
  for (const rule of rules) {
    if (rule instanceof view.CSSMediaRule && DARK_MEDIA.test(rule.conditionText)) {
      return true
    }

    if ('cssRules' in rule && hasDarkMedia((rule as CSSGroupingRule).cssRules, view)) {
      return true
    }
  }

  return false
}

function readsDarkVariant(frameDocument: Document): boolean {
  const view = frameDocument.defaultView
  const sheets = Array.from(frameDocument.styleSheets, (sheet) => rulesOf(sheet))
  const texts = sheets.map((rules) => rules.map((rule) => rule.cssText).join('\n'))

  return (
    detectDarkVariant(readCustomProperties(texts)) !== null ||
    (view !== null && sheets.some((rules) => hasDarkMedia(rules, view))) ||
    texts.some((text) => text.includes('light-dark('))
  )
}

/**
 * Whether the CSS of a replayed frame has a dark variant: one that
 * Foundations detects in its custom properties, a `prefers-color-scheme: dark`
 * rule at any depth, or a `light-dark()` value, which follows the frame's
 * scheme too. Read once per document.
 */
export function frameHasDarkVariant(frameDocument: Document): boolean {
  let found = known.get(frameDocument)

  if (found === undefined) {
    found = readsDarkVariant(frameDocument)
    known.set(frameDocument, found)
  }

  return found
}
