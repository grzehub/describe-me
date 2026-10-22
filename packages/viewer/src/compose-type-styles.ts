import type { PlacedItem } from './build-foundations-model.js'
import type { TypographyPartName } from './typography-part.js'
import { typographyPart } from './typography-part.js'

/** In the order a style's row lists them, as Material UI's variants do. */
const PART_ORDER: TypographyPartName[] = [
  'fontFamily',
  'fontWeight',
  'fontSize',
  'lineHeight',
  'letterSpacing',
]

/** The custom properties of each stem by their part, in the order they come. */
function stemsOf(placed: PlacedItem[]): Map<string, Map<TypographyPartName, PlacedItem>> {
  const stems = new Map<string, Map<TypographyPartName, PlacedItem>>()

  for (const entry of placed) {
    const found = entry.source === 'property' ? typographyPart(entry.item.name) : null

    if (entry.group !== 'typography' || !found?.stem) {
      continue
    }

    const parts = stems.get(found.stem) ?? new Map<TypographyPartName, PlacedItem>()

    // A second name for the same part, such as `--x-fontSize` next to `--x-font-size`, keeps its own row.
    if (!parts.has(found.part)) {
      parts.set(found.part, entry)
    }

    stems.set(found.stem, parts)
  }

  return stems
}

/**
 * Typography rarely changes with the color scheme, so the parts print their
 * light values. The sample paints through the custom properties.
 */
function styleOf(stem: string, parts: Map<TypographyPartName, PlacedItem>): PlacedItem {
  const size = parts.get('fontSize')!.item
  const members = PART_ORDER.flatMap((part) => {
    const item = parts.get(part)?.item

    return item ? [{ part, item }] : []
  })

  return {
    group: 'typography',
    source: 'property',
    item: {
      name: `${stem}-*`,
      type: 'typography',
      paint: size.paint,
      raw: size.raw,
      parts: Object.fromEntries(members.map(({ part, item }) => [part, item.raw.light])),
      members: Object.fromEntries(members.map(({ part, item }) => [part, item.name])),
    },
  }
}

/**
 * Custom properties whose names end in a typography part and share what
 * comes before it, such as `--type-title-font-size` and
 * `--type-title-line-height`, as one composite style `--type-title-*`. A
 * style needs a font size and at least one other part. It takes the place of
 * its first custom property.
 */
export function composeTypeStyles(placed: PlacedItem[]): PlacedItem[] {
  const styles = new Map<PlacedItem, PlacedItem>()
  const composed = new Set<PlacedItem>()

  for (const [stem, parts] of stemsOf(placed)) {
    const [first] = parts.values()

    if (!first || !parts.has('fontSize') || parts.size < 2) {
      continue
    }

    styles.set(first, styleOf(stem, parts))
    parts.forEach((entry) => composed.add(entry))
  }

  return placed.flatMap((entry) => {
    const style = styles.get(entry)

    if (style) {
      return [style]
    }

    return composed.has(entry) ? [] : [entry]
  })
}
