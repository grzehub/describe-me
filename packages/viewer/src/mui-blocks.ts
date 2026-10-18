import type {
  BlockLayout,
  FoundationBlock,
  FoundationItem,
  PlacedItem,
  PresetResult,
  SectionBlock,
} from './build-foundations-model.js'

type MuiSource = 'theme' | 'property'

/** A block of the preset, with the prefix it shows per source. A block of one name has none. */
interface Spec {
  id: string
  title: string
  theme?: string
  property?: string
}

interface Claim {
  entry: PlacedItem
  id: string
}

const INTENTS = ['primary', 'secondary', 'error', 'warning', 'info', 'success']
const SHADES = ['main', 'light', 'dark', 'contrastText']
const PALETTE_GROUPS = ['grey', 'text', 'background', 'common', 'action']
const VARIANTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'subtitle1',
  'subtitle2',
  'body1',
  'body2',
  'button',
  'caption',
  'overline',
]

const SPACING_STEPS = 13
const PROPERTY_PREFIX = '--mui-'
const CHANNEL = 'Channel'
const THEME_SPACING = /^spacing\(\d+\)$/
const COMPONENT = /^[A-Z]/
const LAST_SEGMENT = /[.-]([^.-]+)$/
const ACCENT_STEP = /^A(\d+)$/
const NUMERIC_STEP = /^\d+$/

/** Blocks that both sources have, by the first segment of the key. */
const SHARED = new Map([
  ['shape', 'mui-shape'],
  ['shadows', 'mui-elevation'],
  ['breakpoints', 'mui-breakpoints'],
  ['zIndex', 'mui-z-index'],
])

/** In the order the view shows them. */
const SPECS: Spec[] = [
  ...INTENTS.map((intent) => ({
    id: `mui-${intent}`,
    title: intent.charAt(0).toUpperCase() + intent.slice(1),
    theme: `palette.${intent}.*`,
    property: `--mui-palette-${intent}-*`,
  })),
  { id: 'mui-grey', title: 'Grey', theme: 'palette.grey.*', property: '--mui-palette-grey-*' },
  { id: 'mui-text', title: 'Text', theme: 'palette.text.*', property: '--mui-palette-text-*' },
  {
    id: 'mui-background',
    title: 'Background',
    theme: 'palette.background.*',
    property: '--mui-palette-background-*',
  },
  { id: 'mui-divider', title: 'Divider' },
  {
    id: 'mui-common',
    title: 'Common',
    theme: 'palette.common.*',
    property: '--mui-palette-common-*',
  },
  {
    id: 'mui-action',
    title: 'Action',
    theme: 'palette.action.*',
    property: '--mui-palette-action-*',
  },
  { id: 'mui-components', title: 'Components', property: '--mui-palette-*' },
  { id: 'mui-variants', title: 'Variants', theme: 'typography.*', property: '--mui-font-*' },
  { id: 'mui-font-family', title: 'Font family' },
  { id: 'mui-font-weights', title: 'Font weights', theme: 'typography.fontWeight*' },
  { id: 'mui-spacing', title: 'Spacing', theme: 'spacing(n)' },
  { id: 'mui-shape', title: 'Shape', theme: 'shape.*', property: '--mui-shape-*' },
  { id: 'mui-elevation', title: 'Elevation', theme: 'shadows.*', property: '--mui-shadows-*' },
  {
    id: 'mui-breakpoints',
    title: 'Breakpoints',
    theme: 'breakpoints.*',
    property: '--mui-breakpoints-*',
  },
  {
    id: 'mui-duration',
    title: 'Duration',
    theme: 'transitions.duration.*',
    property: '--mui-transitions-duration-*',
  },
  {
    id: 'mui-easing',
    title: 'Easing',
    theme: 'transitions.easing.*',
    property: '--mui-transitions-easing-*',
  },
  { id: 'mui-z-index', title: 'z-index', theme: 'zIndex.*', property: '--mui-zIndex-*' },
  { id: 'mui-opacity', title: 'Opacity', property: '--mui-opacity-*' },
  { id: 'mui-overlays', title: 'Overlays', property: '--mui-overlays-*' },
]

const INTENT_IDS = INTENTS.map((intent) => `mui-${intent}`)

/** `palette.primary.main` for the theme module, the same path from `--mui-palette-primary-main`. */
function pathOf(entry: PlacedItem, source: MuiSource): string[] | null {
  if (source === 'theme') {
    return entry.source === 'theme' ? entry.item.name.split('.') : null
  }

  if (entry.source !== 'property' || !entry.item.name.startsWith(PROPERTY_PREFIX)) {
    return null
  }

  return entry.item.name.slice(PROPERTY_PREFIX.length).split('-')
}

function paletteBlock(path: string[], source: MuiSource): string | null {
  const [, group = '', shade = ''] = path

  if (path.length === 2) {
    return group === 'divider' ? 'mui-divider' : null
  }

  if (path.length !== 3) {
    return null
  }

  if (INTENTS.includes(group)) {
    return SHADES.includes(shade) ? `mui-${group}` : null
  }

  if (PALETTE_GROUPS.includes(group)) {
    return `mui-${group}`
  }

  return source === 'property' && COMPONENT.test(group) ? 'mui-components' : null
}

function sharedBlock(path: string[]): string | null {
  const [head = '', second = ''] = path

  if (head === 'transitions' && path.length === 3) {
    if (second === 'duration') {
      return 'mui-duration'
    }

    return second === 'easing' ? 'mui-easing' : null
  }

  const id = SHARED.get(head)

  return id !== undefined && path.length === 2 ? id : null
}

function themeBlock(path: string[], item: FoundationItem): string | null {
  const [head = '', second = ''] = path

  if (head === 'typography' && path.length === 2) {
    if (item.type === 'typography') {
      return 'mui-variants'
    }

    if (second === 'fontFamily') {
      return 'mui-font-family'
    }

    return second.startsWith('fontWeight') ? 'mui-font-weights' : null
  }

  if (path.length === 1 && THEME_SPACING.test(head)) {
    return 'mui-spacing'
  }

  return sharedBlock(path)
}

function propertyBlock(path: string[]): string | null {
  const [head = ''] = path

  if (head === 'font' && path.length === 2) {
    return 'mui-variants'
  }

  if (head === 'spacing' && path.length === 1) {
    return 'mui-spacing'
  }

  if ((head === 'opacity' || head === 'overlays') && path.length === 2) {
    return `mui-${head}`
  }

  return sharedBlock(path)
}

function blockIdOf(path: string[], source: MuiSource, item: FoundationItem): string | null {
  if (path[0] === 'palette') {
    return paletteBlock(path, source)
  }

  return source === 'theme' ? themeBlock(path, item) : propertyBlock(path)
}

/** The block of the color a `…Channel` property repeats, such as `mui-primary` for `mainChannel`. */
function channelBlock(path: string[], item: FoundationItem): string | null {
  const last = path[path.length - 1] ?? ''
  const color = [...path.slice(0, -1), last.slice(0, -CHANNEL.length)]

  return blockIdOf(color, 'property', item)
}

function lastSegment(name: string): string {
  return LAST_SEGMENT.exec(name)?.[1] ?? name
}

/** 50 to 900, then A100 to A700. */
function greyRank(step: string): number {
  const accent = ACCENT_STEP.exec(step)

  if (accent) {
    return 10_000 + Number(accent[1])
  }

  return NUMERIC_STEP.test(step) ? Number(step) : 20_000
}

function rankBy(items: FoundationItem[], rank: (step: string) => number): FoundationItem[] {
  return [...items].sort(
    (left, right) => rank(lastSegment(left.name)) - rank(lastSegment(right.name)),
  )
}

/** Unknown names keep their order after the known ones. */
function rankIn(known: string[]): (step: string) => number {
  return (step) => {
    const at = known.indexOf(step)

    return at === -1 ? known.length : at
  }
}

function sorted(id: string, items: FoundationItem[]): FoundationItem[] {
  if (INTENT_IDS.includes(id)) {
    return rankBy(items, rankIn(SHADES))
  }

  if (id === 'mui-grey') {
    return rankBy(items, greyRank)
  }

  return id === 'mui-variants' ? rankBy(items, rankIn(VARIANTS)) : items
}

function spacingScale(items: FoundationItem[]): BlockLayout | undefined {
  const base = items.find((item) => item.name === `${PROPERTY_PREFIX}spacing`)

  if (!base) {
    return undefined
  }

  const steps = Array.from({ length: SPACING_STEPS }, (_, step) => ({
    step,
    label: `spacing(${step})`,
  }))

  return { kind: 'scale', base: base.name, steps }
}

/** `contrastText` on `main`, as Material UI paints a contained button. */
function intentPair(items: FoundationItem[]): BlockLayout | undefined {
  const main = items.find((item) => lastSegment(item.name) === 'main')
  const contrast = items.find((item) => lastSegment(item.name) === 'contrastText')

  if (!main || !contrast) {
    return undefined
  }

  return {
    kind: 'pairs',
    pairs: [{ background: main.name, foreground: contrast.name, tile: 'foreground' }],
  }
}

function layoutOf(id: string, items: FoundationItem[], source: MuiSource): BlockLayout | undefined {
  if (INTENT_IDS.includes(id)) {
    return intentPair(items)
  }

  if (id === 'mui-grey') {
    return { kind: 'ramp' }
  }

  if (id === 'mui-variants') {
    return { kind: 'variants' }
  }

  return id === 'mui-spacing' && source === 'property' ? spacingScale(items) : undefined
}

function channelNote(count: number): string | undefined {
  if (count === 0) {
    return undefined
  }

  if (count === 1) {
    return '1 `…Channel` property left out. It repeats this color as channels for alpha.'
  }

  return `${count} \`…Channel\` properties left out. They repeat these colors as channels for alpha.`
}

function blocksOf(
  spec: Spec,
  claims: Claim[],
  channels: ReadonlyMap<string, number>,
  source: MuiSource,
): SectionBlock[] {
  const entries = claims.filter((claim) => claim.id === spec.id).map((claim) => claim.entry)
  const sections = [...new Set(entries.map((entry) => entry.group))]
  // The channels repeat colors, so their note goes with the colors.
  const noted = sections.includes('colors') ? 'colors' : sections[0]
  const prefix = spec[source]

  return sections.map((section) => {
    const items = sorted(
      spec.id,
      entries.filter((entry) => entry.group === section).map((entry) => entry.item),
    )

    const block: FoundationBlock = { id: spec.id, title: spec.title, items }
    const layout = layoutOf(spec.id, items, source)
    const note = section === noted ? channelNote(channels.get(spec.id) ?? 0) : undefined

    if (prefix) {
      block.prefix = prefix
    }

    if (layout) {
      block.layout = layout
    }

    if (note) {
      block.note = note
    }

    return { section, from: source, block }
  })
}

/**
 * The Material UI preset: palette by intent, greys, typography variants,
 * spacing, shape, elevation, breakpoints, motion and z-index. It reads the
 * theme module's tokens, or without one the `--mui-*` custom properties, whose
 * `…Channel` repeats it leaves out and counts. What the table does not claim
 * goes on to the next preset.
 */
export function muiBlocks(placed: PlacedItem[], source: MuiSource): PresetResult {
  const claims: Claim[] = []
  const channels = new Map<string, number>()
  const rest: PlacedItem[] = []

  for (const entry of placed) {
    const path = pathOf(entry, source)
    const id = path ? blockIdOf(path, source, entry.item) : null

    if (path && source === 'property' && entry.item.name.endsWith(CHANNEL)) {
      const channel = channelBlock(path, entry.item)

      if (channel) {
        channels.set(channel, (channels.get(channel) ?? 0) + 1)
      }
    } else if (id) {
      claims.push({ entry, id })
    } else {
      rest.push(entry)
    }
  }

  return { blocks: SPECS.flatMap((spec) => blocksOf(spec, claims, channels, source)), rest }
}
