import { isRootSelector } from './is-root-selector.js'
import { splitLightDark } from './split-light-dark.js'

/** How the dark value of a custom property was declared. */
export type DarkSource =
  | { kind: 'media' }
  | { kind: 'class'; selector: string }
  | { kind: 'attribute'; selector: string }
  | { kind: 'light-dark' }

/** A custom property that the token sheets declare on a root-like selector. */
export interface CustomProperty {
  name: string
  /** Absent when only the dark variant declares it. */
  light?: string
  /** Absent when the project declares no dark value for it. */
  dark?: string
  darkSource?: DarkSource
}

/** Where a declaration sits: in the dark variant, or in one of three tiers of light values. */
type Placement = { dark: DarkSource } | { tier: 0 | 1 | 2 }

interface Collected {
  tiers: (string | undefined)[]
  dark?: string
  darkSource?: DarkSource
}

const DARK_MEDIA = /prefers-color-scheme\s*:\s*dark/i

/** The simple selectors of a root-like compound, which the CSSOM writes with quoted values. */
const SIMPLE_SELECTOR = /html|:root|:host|\.dark|\.light|\[[^\]]*\]/g

const DARK_ATTRIBUTE = /^\[data-[\w-]+="dark"\]$/
const LIGHT_ATTRIBUTE = /^\[data-[\w-]+="light"\]$/
const PLAIN_ROOTS = [':root', ':host', 'html']

/** Split a selector list at its top-level commas, so `:is(a, b)` stays whole. */
function splitSelectorList(text: string): string[] {
  const selectors: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '(' || char === '[') {
      depth++
    } else if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      selectors.push(text.slice(start, i).trim())
      start = i + 1
    }
  }

  selectors.push(text.slice(start).trim())

  return selectors
}

function partsOf(selector: string): string[] {
  return selector.match(SIMPLE_SELECTOR) ?? []
}

function namesDark(selector: string): boolean {
  return partsOf(selector).some((part) => part === '.dark' || DARK_ATTRIBUTE.test(part))
}

function namesLight(selector: string): boolean {
  return partsOf(selector).some((part) => part === '.light' || LIGHT_ATTRIBUTE.test(part))
}

function isPlain(selector: string): boolean {
  const parts = partsOf(selector)

  return parts.length === 1 && PLAIN_ROOTS.includes(parts[0] ?? '')
}

function placementOf(selectors: string[], inMedia: boolean, darkMedia: boolean): Placement {
  if (darkMedia) {
    return { dark: { kind: 'media' } }
  }

  if (selectors.every((selector) => namesDark(selector))) {
    const [first = ''] = selectors
    const kind = partsOf(first).includes('.dark') ? 'class' : 'attribute'

    return { dark: { kind, selector: first } }
  }

  if (!inMedia && selectors.some((selector) => isPlain(selector))) {
    return { tier: 0 }
  }

  if (selectors.some((selector) => namesLight(selector))) {
    return { tier: 1 }
  }

  return { tier: 2 }
}

function readRule(
  rule: CSSStyleRule,
  inMedia: boolean,
  darkMedia: boolean,
  found: Map<string, Collected>,
): void {
  const selectors = splitSelectorList(rule.selectorText).filter((selector) =>
    isRootSelector(selector),
  )

  if (selectors.length === 0) {
    return
  }

  const placement = placementOf(selectors, inMedia, darkMedia)

  for (let i = 0; i < rule.style.length; i++) {
    const name = rule.style.item(i)

    if (!name.startsWith('--')) {
      continue
    }

    const value = rule.style.getPropertyValue(name).trim()
    let collected = found.get(name)

    if (!collected) {
      collected = { tiers: [] }
      found.set(name, collected)
    }

    if ('dark' in placement) {
      collected.dark = value
      collected.darkSource = placement.dark
    } else {
      collected.tiers[placement.tier] = value
    }
  }
}

function walk(
  rules: CSSRuleList,
  inMedia: boolean,
  darkMedia: boolean,
  found: Map<string, Collected>,
): void {
  for (const rule of Array.from(rules)) {
    // Checked first: with nesting, a style rule has `cssRules` too, and its children are not root rules.
    if (rule instanceof CSSStyleRule) {
      readRule(rule, inMedia, darkMedia, found)
    } else if (rule instanceof CSSMediaRule) {
      walk(rule.cssRules, true, darkMedia || DARK_MEDIA.test(rule.conditionText), found)
    } else if ('cssRules' in rule) {
      walk((rule as CSSGroupingRule).cssRules, inMedia, darkMedia, found)
    }
  }
}

function finish(name: string, collected: Collected): CustomProperty {
  const [plain, light, other] = collected.tiers
  const declared = plain ?? light ?? other
  const split = declared === undefined ? null : splitLightDark(declared)
  const property: CustomProperty = { name }

  if (declared !== undefined) {
    property.light = split?.light ?? declared
  }

  if (collected.dark !== undefined) {
    property.dark = splitLightDark(collected.dark)?.dark ?? collected.dark
    property.darkSource = collected.darkSource
  } else if (split) {
    property.dark = split.dark
    property.darkSource = { kind: 'light-dark' }
  }

  return property
}

/**
 * The custom properties that the token sheets declare on root-like selectors,
 * one per name in first-appearance order, each with its light and dark value.
 * Every text is parsed into a sheet that is never adopted.
 */
export function readCustomProperties(sheets: string[]): CustomProperty[] {
  const found = new Map<string, Collected>()

  for (const text of sheets) {
    const sheet = new CSSStyleSheet()

    try {
      sheet.replaceSync(text)
    } catch {
      continue
    }

    walk(sheet.cssRules, false, false, found)
  }

  return Array.from(found, ([name, collected]) => finish(name, collected))
}
