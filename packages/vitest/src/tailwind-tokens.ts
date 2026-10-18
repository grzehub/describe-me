import type { FoundationGroup, FoundationToken, FoundationTokenType } from '@describe-me/core/types'
import type { TailwindThemeEntry } from './load-tailwind-theme.js'
import { splitLightDark } from './split-light-dark.js'

/**
 * `@theme reference`: Tailwind knows the key but writes no variable for it,
 * like its own `--radius` and `--shadow`, which only back utilities.
 */
const REFERENCE = 2

/** A value Tailwind ships, which a project can override. */
const DEFAULT = 4

/** A theme entry that is kept, with its value as CSS text. */
interface KeptEntry {
  name: string
  value: string
  options: number
}

interface PrefixRule {
  prefix: string
  group: FoundationGroup
  type?: FoundationTokenType
}

/** Checked longest first, so `--text-shadow-` wins over `--text-` and `--font-weight-` over `--font-`. */
const PREFIX_RULES: PrefixRule[] = (
  [
    { prefix: '--text-shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--inset-shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--drop-shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--shadow-', group: 'shadows', type: 'shadow' },
    { prefix: '--color-', group: 'colors', type: 'color' },
    { prefix: '--font-weight-', group: 'typography', type: 'fontWeight' },
    { prefix: '--font-', group: 'typography', type: 'fontFamily' },
    { prefix: '--default-font-family', group: 'typography', type: 'fontFamily' },
    { prefix: '--default-mono-font-family', group: 'typography', type: 'fontFamily' },
    { prefix: '--default-font-', group: 'typography' },
    { prefix: '--default-mono-font-', group: 'typography' },
    { prefix: '--text-', group: 'typography', type: 'dimension' },
    { prefix: '--tracking-', group: 'typography', type: 'dimension' },
    { prefix: '--leading-', group: 'typography', type: 'number' },
    { prefix: '--spacing', group: 'spacing', type: 'dimension' },
    { prefix: '--radius-', group: 'radius', type: 'dimension' },
    { prefix: '--breakpoint-', group: 'breakpoints', type: 'dimension' },
    { prefix: '--container-', group: 'breakpoints', type: 'dimension' },
    { prefix: '--ease-', group: 'motion', type: 'cubicBezier' },
    { prefix: '--default-transition-timing-function', group: 'motion', type: 'cubicBezier' },
    { prefix: '--default-transition-duration', group: 'motion', type: 'duration' },
    { prefix: '--animate-', group: 'motion' },
  ] satisfies PrefixRule[]
).sort((left, right) => right.prefix.length - left.prefix.length)

/** `--theme(--font-sans, initial)`, which Tailwind writes into the CSS as `var(--font-sans)`. */
const THEME_FUNCTION = /^--theme\(\s*(--[\w-]+)\s*(?:,.*)?\)$/

function ruleFor(name: string): PrefixRule | undefined {
  return PREFIX_RULES.find((rule) => name.startsWith(rule.prefix))
}

function cssValueOf(raw: string): string {
  const value = raw.replace(/\s+/g, ' ').trim()
  const themeFunction = THEME_FUNCTION.exec(value)

  return themeFunction === null ? value : `var(${themeFunction[1]})`
}

function camelCase(property: string): string {
  return property.replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())
}

/** `--text-xs--line-height` as `['--text-xs', 'line-height']`, or null for a key without a nested part. */
function nestedKey(name: string): [string, string] | null {
  const at = name.indexOf('--', 2)

  if (at === -1 || at + 2 >= name.length) {
    return null
  }

  return [name.slice(0, at), name.slice(at + 2)]
}

function tokenOf({ name, value, options }: KeptEntry): FoundationToken {
  const rule = ruleFor(name)
  const modes = splitLightDark(value)

  return {
    name,
    group: rule?.group ?? 'other',
    ...(rule?.type === undefined ? {} : { type: rule.type }),
    value: modes?.light ?? value,
    ...(modes === null ? {} : { modes }),
    origin: options & DEFAULT ? 'default' : 'project',
    source: 'tailwind',
  }
}

/**
 * The tokens of a Tailwind 4 theme, project and default ones, grouped and
 * typed by their prefix. A nested key such as `--text-xs--line-height`
 * becomes a part of its token. `@theme inline` aliases stay project tokens
 * with their `var(--…)` value.
 */
export function tailwindTokens(entries: readonly TailwindThemeEntry[]): FoundationToken[] {
  const kept: KeptEntry[] = entries
    .filter(([, { value, options }]) => (options & REFERENCE) === 0 && value.trim() !== 'initial')
    .map(([name, { value, options }]) => ({ name, value: cssValueOf(value), options }))

  const tokens = new Map<string, FoundationToken>()
  const nested: KeptEntry[] = []

  for (const entry of kept) {
    if (nestedKey(entry.name) === null) {
      tokens.set(entry.name, tokenOf(entry))
    } else {
      nested.push(entry)
    }
  }

  // After every plain key, so a part finds its token wherever the theme lists it.
  for (const entry of nested) {
    const [base, part] = nestedKey(entry.name) ?? [entry.name, '']
    const token = tokens.get(base)

    if (token === undefined) {
      tokens.set(entry.name, tokenOf(entry))
    } else {
      token.parts = { ...token.parts, [camelCase(part)]: entry.value }
    }
  }

  return [...tokens.values()]
}
