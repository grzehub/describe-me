import type { FoundationGroup } from '@describe-me/core/types'
import type {
  BlockLayout,
  ColorPair,
  FoundationBlock,
  FoundationItem,
  PlacedItem,
  PresetResult,
  SectionBlock,
} from './build-foundations-model.js'

/** `var(--radius)`, alone or inside `calc()`, as shadcn/ui derives its radius scale. */
const RADIUS_REFERENCE = /var\(\s*--radius\s*[,)]/

/** `--X-foreground` for `--X`, and `--foreground` for `--background`. */
function foregroundOf(name: string): string {
  return name === '--background' ? '--foreground' : `${name}-foreground`
}

/** The pairs in the order of their background, then the singles. */
function paired(items: FoundationItem[]): { items: FoundationItem[]; layout?: BlockLayout } {
  const byName = new Map(items.map((item) => [item.name, item]))
  const pairs: ColorPair[] = []
  const taken = new Set<FoundationItem>()

  for (const item of items) {
    const foreground = byName.get(foregroundOf(item.name))

    if (foreground && !taken.has(item) && !taken.has(foreground)) {
      pairs.push({ background: item.name, foreground: foreground.name, tile: 'background' })
      taken.add(item).add(foreground)
    }
  }

  const ordered = [...taken, ...items.filter((item) => !taken.has(item))]

  if (pairs.length === 0) {
    return { items: ordered }
  }

  return { items: ordered, layout: { kind: 'pairs', pairs } }
}

function colorBlock(
  entries: PlacedItem[],
  base: Omit<FoundationBlock, 'items'>,
  pairs: boolean,
): SectionBlock {
  const items = entries.map((entry) => entry.item)
  const block: FoundationBlock = pairs ? { ...base, ...paired(items) } : { ...base, items }

  return { section: 'colors', from: 'property', block }
}

/** `--radius` first, then the Tailwind radius tokens derived from it, per section. */
function radiusBlocks(entries: PlacedItem[]): SectionBlock[] {
  const ordered = [
    ...entries.filter((entry) => entry.source === 'property'),
    ...entries.filter((entry) => entry.source !== 'property'),
  ]

  const sections = [...new Set(ordered.map((entry) => entry.group))]

  return sections.map((section: FoundationGroup) => ({
    section,
    from: 'property',
    block: {
      id: 'shadcn-radius',
      title: 'Radius',
      items: ordered.filter((entry) => entry.group === section).map((entry) => entry.item),
    },
  }))
}

function isRadius(entry: PlacedItem): boolean {
  if (entry.source === 'property') {
    return entry.item.name === '--radius'
  }

  return (
    entry.source === 'tailwind' &&
    entry.group === 'radius' &&
    RADIUS_REFERENCE.test(entry.item.raw.light)
  )
}

/**
 * The shadcn/ui preset: semantic colors as background and foreground pairs,
 * the chart and sidebar colors, and `--radius` with the Tailwind radius tokens
 * derived from it. Every other item goes on to the next preset.
 */
export function shadcnBlocks(placed: PlacedItem[]): PresetResult {
  const colors = placed.filter((entry) => entry.source === 'property' && entry.group === 'colors')
  const chart = colors.filter((entry) => entry.item.name.startsWith('--chart-'))
  const sidebar = colors.filter((entry) => entry.item.name.startsWith('--sidebar'))
  const semantic = colors.filter((entry) => !chart.includes(entry) && !sidebar.includes(entry))
  const radius = placed.filter((entry) => isRadius(entry))
  const claimed = new Set([...colors, ...radius])

  const blocks = [
    colorBlock(semantic, { id: 'shadcn-semantic', title: 'Semantic colors' }, true),
    colorBlock(chart, { id: 'shadcn-chart', title: 'Chart', prefix: '--chart-*' }, false),
    colorBlock(sidebar, { id: 'shadcn-sidebar', title: 'Sidebar', prefix: '--sidebar-*' }, true),
    ...radiusBlocks(radius),
  ]

  return { blocks, rest: placed.filter((entry) => !claimed.has(entry)) }
}
