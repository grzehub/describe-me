import type { FoundationGroup } from '@describe-me/core/types'
import type { FoundationItem, PlacedItem, SectionBlock } from './build-foundations-model.js'
import { FOUNDATION_SECTIONS } from './foundation-sections.js'
import { readableTitle } from './readable-title.js'

/**
 * A name without its leading `--`, split at its dashes. The `*` of a composed
 * style such as `--type-title-*` is not a segment.
 */
function segmentsOf(name: string): string[] {
  return name.split('-').filter((segment) => segment !== '' && segment !== '*')
}

/** The first two segments of a longer name, the first of a name of two, none for one. */
function groupKey(name: string): string | null {
  const segments = segmentsOf(name)

  if (segments.length >= 3) {
    return segments.slice(0, 2).join('-')
  }

  return segments.length === 2 ? (segments[0] ?? null) : null
}

/** The longest run of whole segments that every name starts with, never a whole name. */
function sharedSegments(items: FoundationItem[]): string[] {
  const [first = [], ...others] = items.map((item) => segmentsOf(item.name))
  const longest = Math.min(...[first, ...others].map((segments) => segments.length - 1))
  let length = 0

  while (length < longest && others.every((segments) => segments[length] === first[length])) {
    length++
  }

  return first.slice(0, length)
}

function propertyBlocks(section: FoundationGroup, items: FoundationItem[]): SectionBlock[] {
  const groups = new Map<string, FoundationItem[]>()

  for (const item of items) {
    const key = groupKey(item.name)

    if (key !== null) {
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
  }

  const shared = [...groups.values()].filter((group) => group.length >= 2)
  const grouped = new Set(shared.flat())
  const leftover = items.filter((item) => !grouped.has(item))

  // Map order is the order of each group's first property.
  const blocks: SectionBlock[] = shared.map((group) => {
    const segments = sharedSegments(group)

    return {
      section,
      from: 'property',
      block: {
        id: `prefix-${segments.join('-')}`,
        title: readableTitle(segments),
        prefix: `--${segments.join('-')}-*`,
        items: group,
      },
    }
  })

  if (leftover.length === 0) {
    return blocks
  }

  const rest: SectionBlock = {
    section,
    from: 'property',
    block: { id: 'custom-properties', title: 'Custom properties', items: leftover },
  }

  return [...blocks, rest]
}

/** `colors.ink` goes to `Colors`, `colors.brand.500` to `Colors brand`, a top-level token to `Theme`. */
function themeBlocks(section: FoundationGroup, items: FoundationItem[]): SectionBlock[] {
  const groups = new Map<string, FoundationItem[]>()

  for (const item of items) {
    const parent = item.name.split('.').slice(0, -1).join('.')
    groups.set(parent, [...(groups.get(parent) ?? []), item])
  }

  return [...groups].map(([parent, group]) => {
    const path = parent === '' ? [] : parent.split('.')

    const block =
      path.length === 0
        ? { id: 'theme', title: 'Theme', items: group }
        : {
            id: `theme-${path.join('-')}`,
            title: readableTitle(path),
            prefix: `${parent}.*`,
            items: group,
          }

    return { section, from: 'theme', block }
  })
}

/**
 * The preset for what no design-system preset claimed: theme-module tokens
 * grouped by their parent path, and custom properties grouped by a shared
 * name prefix, such as `--chakra-colors-*`, with the rest in `Custom properties`.
 */
export function genericBlocks(placed: PlacedItem[]): SectionBlock[] {
  return FOUNDATION_SECTIONS.flatMap(({ id }) => {
    const inSection = placed.filter((entry) => entry.group === id)
    const theme = inSection.filter((entry) => entry.source === 'theme').map((entry) => entry.item)
    const others = inSection.filter((entry) => entry.source !== 'theme').map((entry) => entry.item)

    return [...themeBlocks(id, theme), ...propertyBlocks(id, others)]
  })
}
