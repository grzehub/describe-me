import type { FoundationGroup } from '@describe-me/core/types'
import type {
  BlockLayout,
  FoundationBlock,
  FoundationItem,
  PaletteRow,
  PlacedItem,
  PresetResult,
  SectionBlock,
} from './build-foundations-model.js'
import { readableTitle } from './readable-title.js'

interface Rule {
  prefix: string
  id: string
  title: string
}

interface Claim {
  entry: PlacedItem
  id: string
  title: string
}

/** Checked in this order, so `--text-shadow-` wins over `--text-` and `--font-weight-` over `--font-`. */
const RULES: Rule[] = [
  { prefix: '--text-shadow-', id: 'tailwind-text-shadows', title: 'Text shadows' },
  { prefix: '--inset-shadow-', id: 'tailwind-inset-shadows', title: 'Inset shadows' },
  { prefix: '--drop-shadow-', id: 'tailwind-drop-shadows', title: 'Drop shadows' },
  { prefix: '--shadow-', id: 'tailwind-box-shadows', title: 'Box shadows' },
  { prefix: '--font-weight-', id: 'tailwind-weights', title: 'Font weights' },
  { prefix: '--font-', id: 'tailwind-fonts', title: 'Font families' },
  { prefix: '--text-', id: 'tailwind-type-scale', title: 'Type scale' },
  { prefix: '--tracking-', id: 'tailwind-tracking', title: 'Tracking' },
  { prefix: '--leading-', id: 'tailwind-leading', title: 'Leading' },
  { prefix: '--default-font-', id: 'tailwind-base-font', title: 'Base font' },
  { prefix: '--default-mono-font-', id: 'tailwind-base-font', title: 'Base font' },
  { prefix: '--spacing', id: 'tailwind-spacing', title: 'Spacing scale' },
  { prefix: '--radius-', id: 'tailwind-radius', title: 'Radius scale' },
  { prefix: '--breakpoint-', id: 'tailwind-breakpoints', title: 'Breakpoints' },
  { prefix: '--container-', id: 'tailwind-containers', title: 'Containers' },
  { prefix: '--ease-', id: 'tailwind-easing', title: 'Easing' },
  { prefix: '--animate-', id: 'tailwind-animations', title: 'Animations' },
  { prefix: '--default-transition-', id: 'tailwind-transitions', title: 'Transitions' },
]

/** The order of the blocks within a section, after the color ramps. */
const ORDER = [
  'tailwind-colors',
  'tailwind-fonts',
  'tailwind-type-scale',
  'tailwind-weights',
  'tailwind-tracking',
  'tailwind-leading',
  'tailwind-base-font',
  'tailwind-spacing',
  'tailwind-radius',
  'tailwind-box-shadows',
  'tailwind-inset-shadows',
  'tailwind-drop-shadows',
  'tailwind-text-shadows',
  'tailwind-breakpoints',
  'tailwind-containers',
  'tailwind-easing',
  'tailwind-animations',
  'tailwind-transitions',
]

const SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96]
const RAMP_STEPS = 3
const COLOR_PREFIX = '--color-'
const COLOR_STEP = /^--color-(.+)-(\d+)$/
const PALETTE_NOTE =
  "Tailwind's default palette. Add `--color-*: initial` to `@theme` to remove it."

const SPACING_NOTE = 'Spacing utilities such as `p-4` use multiples of `--spacing`.'

const SAMPLES = new Map<string, 'font-weight' | 'letter-spacing' | 'line-height'>([
  ['tailwind-weights', 'font-weight'],
  ['tailwind-tracking', 'letter-spacing'],
  ['tailwind-leading', 'line-height'],
])

const SHADOWS = new Map<string, 'box-shadow' | 'filter' | 'text-shadow'>([
  ['tailwind-box-shadows', 'box-shadow'],
  ['tailwind-inset-shadows', 'box-shadow'],
  ['tailwind-drop-shadows', 'filter'],
  ['tailwind-text-shadows', 'text-shadow'],
])

/** `brand` and `500` for `--color-brand-500`, or null for a name without a numeric step. */
function colorStep(name: string): { family: string; step: number } | null {
  const match = COLOR_STEP.exec(name)

  if (!match?.[1] || !match[2]) {
    return null
  }

  return { family: match[1], step: Number(match[2]) }
}

/** The project's color families with at least three numeric steps. */
function rampFamilies(entries: PlacedItem[]): Set<string> {
  const steps = new Map<string, number>()

  for (const entry of entries) {
    const family = colorStep(entry.item.name)?.family

    if (entry.item.origin !== 'default' && family !== undefined) {
      steps.set(family, (steps.get(family) ?? 0) + 1)
    }
  }

  return new Set([...steps].filter(([, count]) => count >= RAMP_STEPS).map(([family]) => family))
}

function colorClaim(entry: PlacedItem, ramps: ReadonlySet<string>): Claim {
  if (entry.item.origin === 'default') {
    return { entry, id: 'tailwind-palette', title: 'Tailwind palette' }
  }

  const family = colorStep(entry.item.name)?.family

  if (family !== undefined && ramps.has(family)) {
    return { entry, id: `tailwind-ramp-${family}`, title: readableTitle([family]) }
  }

  return { entry, id: 'tailwind-colors', title: 'Theme colors' }
}

function claimOf(entry: PlacedItem, ramps: ReadonlySet<string>): Claim {
  const name = entry.item.name

  if (name.startsWith(COLOR_PREFIX)) {
    return colorClaim(entry, ramps)
  }

  const rule = RULES.find((candidate) => name.startsWith(candidate.prefix))

  if (rule) {
    return { entry, id: rule.id, title: rule.title }
  }

  const namespace = name.slice(2).split('-')[0] ?? ''

  return { entry, id: `tailwind-${namespace}`, title: readableTitle([namespace]) }
}

/** One row per family in theme order, then the colors without a step, such as black and white. */
function paletteRows(items: FoundationItem[]): PaletteRow[] {
  const rows = new Map<string, string[]>()
  const loose: string[] = []

  for (const item of items) {
    const family = colorStep(item.name)?.family

    if (family === undefined) {
      loose.push(item.name)
    } else {
      rows.set(family, [...(rows.get(family) ?? []), item.name])
    }
  }

  const families = [...rows].map(([label, names]) => ({ label, names }))

  if (loose.length === 0) {
    return families
  }

  const label = loose.map((name) => name.slice(COLOR_PREFIX.length)).join(' · ')

  return [...families, { label, names: loose }]
}

function layoutOf(
  id: string,
  items: FoundationItem[],
  font?: FoundationItem,
): BlockLayout | undefined {
  if (id.startsWith('tailwind-ramp-')) {
    return { kind: 'ramp' }
  }

  if (id === 'tailwind-palette') {
    return { kind: 'palette', rows: paletteRows(items) }
  }

  if (id === 'tailwind-spacing' && items.some((item) => item.name === '--spacing')) {
    const steps = SPACING_STEPS.map((step) => ({ step, label: `p-${step}` }))

    return { kind: 'scale', base: '--spacing', steps }
  }

  const sample = SAMPLES.get(id)

  if (sample) {
    return font
      ? { kind: 'samples', property: sample, font: font.paint }
      : { kind: 'samples', property: sample }
  }

  const shadow = SHADOWS.get(id)

  return shadow ? { kind: 'shadows', property: shadow } : undefined
}

function noteOf(id: string, layout?: BlockLayout): string | undefined {
  if (id === 'tailwind-palette') {
    return PALETTE_NOTE
  }

  return layout?.kind === 'scale' ? SPACING_NOTE : undefined
}

function stepOf(item: FoundationItem): number {
  return colorStep(item.name)?.step ?? 0
}

function blockOf(id: string, title: string, entries: PlacedItem[], font?: FoundationItem) {
  const ramp = id.startsWith('tailwind-ramp-')
  const items = entries.map((entry) => entry.item)
  const ordered = ramp ? [...items].sort((left, right) => stepOf(left) - stepOf(right)) : items
  const block: FoundationBlock = { id, title, items: ordered }
  const layout = layoutOf(id, ordered, font)
  const note = noteOf(id, layout)

  if (ramp) {
    block.prefix = `${COLOR_PREFIX}${id.slice('tailwind-ramp-'.length)}-*`
  }

  if (layout) {
    block.layout = layout
  }

  if (note) {
    block.note = note
  }

  if (id === 'tailwind-palette') {
    block.defaults = true
  }

  return block
}

/** Ramps first, then the fixed order, then namespaces in theme order, and the palette last. */
function rank(id: string): number {
  if (id.startsWith('tailwind-ramp-')) {
    return -1
  }

  if (id === 'tailwind-palette') {
    return ORDER.length + 1
  }

  const at = ORDER.indexOf(id)

  return at === -1 ? ORDER.length : at
}

/**
 * The Tailwind 4 preset: project color ramps, theme colors and the default
 * palette, then a block per theme namespace, such as the type scale, the
 * spacing scale or drop shadows. It takes every Tailwind token that is left.
 */
export function tailwindBlocks(placed: PlacedItem[]): PresetResult {
  const tailwind = placed.filter((entry) => entry.source === 'tailwind')
  const ramps = rampFamilies(tailwind.filter((entry) => entry.group === 'colors'))
  const claims = tailwind.map((entry) => claimOf(entry, ramps))
  const font = tailwind.find((entry) => entry.item.name === '--font-sans')?.item
  const keys = [
    ...new Map(claims.map((claim) => [`${claim.entry.group} ${claim.id}`, claim])).values(),
  ]

  const ordered = [...keys].sort((left, right) => rank(left.id) - rank(right.id))

  const blocks: SectionBlock[] = ordered.map((first) => {
    const section: FoundationGroup = first.entry.group
    const entries = claims
      .filter((claim) => claim.id === first.id && claim.entry.group === section)
      .map((claim) => claim.entry)

    return { section, from: 'tailwind', block: blockOf(first.id, first.title, entries, font) }
  })

  return { blocks, rest: placed.filter((entry) => entry.source !== 'tailwind') }
}
