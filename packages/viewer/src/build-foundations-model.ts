import type {
  FoundationGroup,
  Foundations,
  FoundationToken,
  FoundationTokenType,
} from '@describe-me/core/types'
import { classifyCustomProperty } from './classify-custom-property.js'
import type { DarkVariant } from './detect-dark-variant.js'
import { detectDarkVariant } from './detect-dark-variant.js'
import { FOUNDATION_SECTIONS } from './foundation-sections.js'
import type { CustomProperty } from './read-custom-properties.js'

/** A value per color scheme, the dark one shown under the dark variant. */
export interface Schemed {
  light: string
  dark: string
}

/** One token or custom property of the view. */
export interface FoundationItem {
  name: string
  type?: FoundationTokenType
  /** The CSS value that paints its specimen. */
  paint: Schemed
  /** The value printed next to it. */
  raw: Schemed
  parts?: Record<string, string>
}

/** A run of items from one source, such as `Custom properties`. */
export interface FoundationBlock {
  title: string
  items: FoundationItem[]
}

/** A section of the view with the blocks that are not empty. */
export interface FoundationSection {
  id: FoundationGroup
  title: string
  count: number
  blocks: FoundationBlock[]
}

/** What the Foundations view shows for one `foundations.json`. */
export interface FoundationsModel {
  /** Only the sections with items, in toolbar order. */
  sections: FoundationSection[]
  darkVariant: DarkVariant | null
  /** Whether any token of the theme or the Tailwind theme has a value per color scheme. */
  tokenModes: boolean
}

type BlockKind = 'theme' | 'properties' | 'project' | 'defaults'

interface Placed {
  group: FoundationGroup
  block: BlockKind
  item: FoundationItem
}

const BLOCK_ORDER: BlockKind[] = ['theme', 'properties', 'project', 'defaults']

/** `var(--x)` and nothing else, as an `@theme inline` alias is written. */
const PLAIN_REFERENCE = /^var\(\s*(--[\w-]+)\s*\)$/

/** A Tailwind token, or one of its parts such as `--text-xs--line-height`. */
function namedLikeTailwind(name: string, tailwind: ReadonlySet<string>): boolean {
  if (tailwind.has(name)) {
    return true
  }

  for (let at = name.indexOf('--', 2); at !== -1; at = name.indexOf('--', at + 2)) {
    if (tailwind.has(name.slice(0, at))) {
      return true
    }
  }

  return false
}

function keptProperties(file: Foundations, properties: CustomProperty[]): CustomProperty[] {
  const tailwind = new Set(
    file.tokens.filter((token) => token.source === 'tailwind').map((token) => token.name),
  )

  const mui = file.theme?.adapter === 'mui'

  return properties.filter((property) => {
    // The theme module holds the same values, with their structure.
    if (mui && property.name.startsWith('--mui-')) {
      return false
    }

    return !namedLikeTailwind(property.name, tailwind)
  })
}

/** An `@theme inline` color alias of a custom property that the view shows. */
function isColorAlias(token: FoundationToken, kept: ReadonlySet<string>): boolean {
  if (token.source !== 'tailwind' || token.group !== 'colors') {
    return false
  }

  const target = PLAIN_REFERENCE.exec(token.value)?.[1]

  return target !== undefined && kept.has(target)
}

function propertyItem(property: CustomProperty, others: ReadonlyMap<string, string>): Placed {
  const light = property.light ?? ''
  const dark = property.dark ?? light
  const kind = classifyCustomProperty(property.name, property.light ?? dark, others)
  const paint = `var(${property.name})`

  return {
    group: kind.group,
    block: 'properties',
    item: {
      name: property.name,
      ...(kind.type === undefined ? {} : { type: kind.type }),
      paint: { light: paint, dark: paint },
      raw: { light, dark },
    },
  }
}

function blockOf(token: FoundationToken): BlockKind {
  if (token.source === 'theme') {
    return 'theme'
  }

  return token.origin === 'default' ? 'defaults' : 'project'
}

/**
 * Tailwind writes only the variables that utilities use, so a token missing
 * from the sheets paints its own value.
 */
function tokenItem(token: FoundationToken, declared: ReadonlySet<string>): Placed {
  const own = { light: token.value, dark: token.modes?.dark ?? token.value }
  const reference = `var(${token.name})`
  const painted = token.source === 'tailwind' && declared.has(token.name)

  return {
    group: token.group,
    block: blockOf(token),
    item: {
      name: token.name,
      ...(token.type === undefined ? {} : { type: token.type }),
      paint: painted ? { light: reference, dark: reference } : own,
      raw: painted ? { light: token.value, dark: token.value } : own,
      ...(token.parts === undefined ? {} : { parts: token.parts }),
    },
  }
}

function blockTitle(kind: BlockKind, file: Foundations): string {
  const titles: Record<BlockKind, string> = {
    theme: `Theme · ${file.theme?.module ?? 'module'}`,
    properties: 'Custom properties',
    project: 'Tailwind theme',
    defaults: 'Tailwind defaults',
  }

  return titles[kind]
}

function sectionsOf(placed: Placed[], file: Foundations): FoundationSection[] {
  const sections: FoundationSection[] = []

  for (const { id, title } of FOUNDATION_SECTIONS) {
    const blocks = BLOCK_ORDER.map((kind) => ({
      title: blockTitle(kind, file),
      items: placed
        .filter((entry) => entry.group === id && entry.block === kind)
        .map((entry) => entry.item),
    })).filter((block) => block.items.length > 0)

    const count = blocks.reduce((sum, block) => sum + block.items.length, 0)

    if (count > 0) {
      sections.push({ id, title, count, blocks })
    }
  }

  return sections
}

/**
 * The sections, blocks and specimens values of the view. A theme module wins
 * over `--mui-*` custom properties, the Tailwind theme over the variables
 * Tailwind writes, and a custom property over the `@theme inline` color alias
 * that points at it. `properties` come from the token sheets.
 */
export function buildFoundationsModel(
  file: Foundations,
  properties: CustomProperty[],
): FoundationsModel {
  const declared = new Set(properties.map((property) => property.name))
  const kept = keptProperties(file, properties)
  const keptNames = new Set(kept.map((property) => property.name))
  const others = new Map<string, string>()

  for (const property of properties) {
    if (property.light !== undefined) {
      others.set(property.name, property.light)
    }
  }

  const placed = [
    ...file.tokens
      .filter((token) => token.source === 'theme')
      .map((token) => tokenItem(token, declared)),
    ...kept.map((property) => propertyItem(property, others)),
    ...file.tokens
      .filter((token) => token.source === 'tailwind' && !isColorAlias(token, keptNames))
      .map((token) => tokenItem(token, declared)),
  ]

  return {
    sections: sectionsOf(placed, file),
    darkVariant: detectDarkVariant(properties),
    tokenModes: file.tokens.some((token) => token.modes),
  }
}
