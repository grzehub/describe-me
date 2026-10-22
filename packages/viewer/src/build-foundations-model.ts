import type {
  FoundationGroup,
  Foundations,
  FoundationToken,
  FoundationTokenType,
} from '@describe-me/core/types'
import { classifyCustomProperty } from './classify-custom-property.js'
import { composeTypeStyles } from './compose-type-styles.js'
import type { DarkVariant } from './detect-dark-variant.js'
import { detectDarkVariant } from './detect-dark-variant.js'
import { FOUNDATION_SECTIONS } from './foundation-sections.js'
import { genericBlocks } from './generic-blocks.js'
import { muiBlocks } from './mui-blocks.js'
import { needsMuiSetup } from './needs-mui-setup.js'
import type { CustomProperty } from './read-custom-properties.js'
import { shadcnBlocks } from './shadcn-blocks.js'
import { tailwindBlocks } from './tailwind-blocks.js'

/** A value per color scheme, the dark one shown under the dark variant. */
export interface Schemed {
  light: string
  dark: string
}

/** One token or custom property of the view. */
export interface FoundationItem {
  name: string
  type?: FoundationTokenType
  /** The token's origin. Custom properties have none. */
  origin?: 'project' | 'default'
  /** The token's origin per color scheme, when only one of its modes is a framework default. */
  modeOrigins?: FoundationToken['modeOrigins']
  /** The CSS value that paints its specimen. */
  paint: Schemed
  /** The value printed next to it. */
  raw: Schemed
  parts?: Record<string, string>
  /** The custom property behind each part of a style composed from them, keyed like `parts`. */
  members?: Record<string, string>
}

/** A background and its foreground, shown as one tile with their contrast. */
export interface ColorPair {
  background: string
  foreground: string
  /** Whose element the tile is. The other token of a `foreground` tile keeps its own swatch. */
  tile: 'background' | 'foreground'
}

/** A row of the compact palette: a family and the names of its chips. */
export interface PaletteRow {
  label: string
  names: string[]
}

/** A derived row of a scale, such as `p-4` for `calc(var(--spacing) * 4)`. */
export interface ScaleStep {
  step: number
  label: string
}

/** How a block lays out its items. Without one, the block takes its section's layout. */
export type BlockLayout =
  | { kind: 'pairs'; pairs: ColorPair[] }
  | { kind: 'ramp' }
  | { kind: 'palette'; rows: PaletteRow[] }
  | { kind: 'scale'; base: string; steps: ScaleStep[] }
  | { kind: 'samples'; property: 'font-weight' | 'letter-spacing' | 'line-height'; font?: Schemed }
  | { kind: 'variants' }
  | { kind: 'shadows'; property: 'box-shadow' | 'filter' | 'text-shadow' }

/** A run of items that belong together, such as `Semantic colors` or `Chakra font sizes`. */
export interface FoundationBlock {
  /** The `data-block` attribute, such as `shadcn-semantic`. */
  id: string
  /** Readable words, never a raw name. */
  title: string
  /** The raw name prefix the items share, such as `--chart-*`. */
  prefix?: string
  /** One sentence. Text between backticks shows as code. */
  note?: string
  /** Only on a block of framework defaults, which carries one badge for all of them. */
  defaults?: boolean
  layout?: BlockLayout
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
  /** Whether the view should say how to show a Material UI theme. */
  muiSetup: boolean
}

/** An item with its section and source, before a preset puts it in a block. */
export interface PlacedItem {
  group: FoundationGroup
  source: 'theme' | 'property' | 'tailwind'
  item: FoundationItem
}

/** A block, the section it shows in and the kind of source it shows. */
export interface SectionBlock {
  section: FoundationGroup
  /** Blocks come in this order within a section: theme module, custom properties, Tailwind. */
  from: PlacedItem['source']
  block: FoundationBlock
}

/** The blocks a preset builds and the items it leaves to the next one. */
export interface PresetResult {
  blocks: SectionBlock[]
  rest: PlacedItem[]
}

const SOURCE_ORDER: PlacedItem['source'][] = ['theme', 'property', 'tailwind']

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

function propertyItem(property: CustomProperty, others: ReadonlyMap<string, string>): PlacedItem {
  const light = property.light ?? ''
  const dark = property.dark ?? light
  const kind = classifyCustomProperty(property.name, property.light ?? dark, others)
  const paint = `var(${property.name})`

  return {
    group: kind.group,
    source: 'property',
    item: {
      name: property.name,
      ...(kind.type === undefined ? {} : { type: kind.type }),
      paint: { light: paint, dark: paint },
      raw: { light, dark },
    },
  }
}

/**
 * Tailwind writes only the variables that utilities use, so a token missing
 * from the sheets paints its own value.
 */
function tokenItem(token: FoundationToken, declared: ReadonlySet<string>): PlacedItem {
  const own = { light: token.value, dark: token.modes?.dark ?? token.value }
  const reference = `var(${token.name})`
  const painted = token.source === 'tailwind' && declared.has(token.name)

  return {
    group: token.group,
    source: token.source,
    item: {
      name: token.name,
      ...(token.type === undefined ? {} : { type: token.type }),
      origin: token.origin,
      ...(token.modeOrigins === undefined ? {} : { modeOrigins: token.modeOrigins }),
      paint: painted ? { light: reference, dark: reference } : own,
      raw: painted ? { light: token.value, dark: token.value } : own,
      ...(token.parts === undefined ? {} : { parts: token.parts }),
    },
  }
}

/** Material UI from its theme module when there is one, else from its `--mui-*` custom properties. */
function muiSource(file: Foundations): 'theme' | 'property' | null {
  if (file.theme?.adapter === 'mui') {
    return 'theme'
  }

  return file.systems.some((system) => system.id === 'mui') ? 'property' : null
}

/**
 * Presets claim items in this order: Material UI, shadcn/ui, Tailwind, then
 * the generic one, which gets what is left with its type styles composed.
 */
function presetBlocks(file: Foundations, placed: PlacedItem[]): SectionBlock[] {
  const source = muiSource(file)
  const mui = source ? muiBlocks(placed, source) : { blocks: [], rest: placed }
  const shadcnUsed = file.systems.some((system) => system.id === 'shadcn')
  const shadcn = shadcnUsed ? shadcnBlocks(mui.rest) : { blocks: [], rest: mui.rest }
  const tailwind = tailwindBlocks(shadcn.rest)
  const generic = genericBlocks(composeTypeStyles(tailwind.rest))

  return [...mui.blocks, ...shadcn.blocks, ...tailwind.blocks, ...generic]
}

function sectionsOf(blocks: SectionBlock[]): FoundationSection[] {
  const sections: FoundationSection[] = []

  for (const { id, title } of FOUNDATION_SECTIONS) {
    const shown = SOURCE_ORDER.flatMap((from) =>
      blocks
        .filter((entry) => entry.section === id && entry.from === from)
        .map((entry) => entry.block),
    ).filter((block) => block.items.length > 0)

    const count = shown.reduce((sum, block) => sum + block.items.length, 0)

    if (count > 0) {
      sections.push({ id, title, count, blocks: shown })
    }
  }

  return sections
}

/**
 * The sections, blocks and specimens values of the view. A theme module wins
 * over `--mui-*` custom properties, the Tailwind theme over the variables
 * Tailwind writes, and a custom property over the `@theme inline` color alias
 * that points at it. `properties` come from the token sheets. Design-system
 * presets then group each section's items into blocks.
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
    sections: sectionsOf(presetBlocks(file, placed)),
    darkVariant: detectDarkVariant(properties),
    tokenModes: file.tokens.some((token) => token.modes),
    muiSetup: needsMuiSetup(file, properties),
  }
}
