import type { FoundationItem } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'
import { typeSample } from './type-sample.js'
import type { TypographyPartName } from './typography-part.js'
import { typographyPart } from './typography-part.js'

const CAMEL_HUMP = /[A-Z]/g

function kebab(property: string): string {
  return property.replace(CAMEL_HUMP, (letter) => `-${letter.toLowerCase()}`)
}

function partsList(build: SpecimenBuild, parts: Record<string, string>): HTMLElement {
  const text = Object.entries(parts)
    .map(([property, value]) => `${property} ${value}`)
    .join(' · ')

  return build.make('span', 'fd-parts', text)
}

function isFontSize(item: FoundationItem, part: TypographyPartName | undefined): boolean {
  const named = item.name.startsWith('--text-') || part === 'fontSize'

  return item.type === 'dimension' && named
}

/** A style composed from custom properties paints through them, so their dark values apply. */
function compositeStyles(item: FoundationItem): Record<string, string> {
  const paints: [string, string][] = item.members
    ? Object.entries(item.members).map(([property, name]) => [property, `var(${name})`])
    : Object.entries(item.parts ?? {})

  return Object.fromEntries(paints.map(([property, value]) => [kebab(property), value]))
}

function compositeRow(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const sample = typeSample(build, compositeStyles(item))

  return build.showRow(item, sample, partsList(build, item.parts ?? {}))
}

function fontSizeRow(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const styles: Record<string, string> = { 'font-size': build.paintOf(item) }

  if (item.parts?.lineHeight) {
    styles['line-height'] = item.parts.lineHeight
  }

  const parts = item.parts ? partsList(build, item.parts) : undefined

  return build.showRow(item, typeSample(build, styles), parts)
}

/**
 * A typography token's row with a sample line in its family, weight, size,
 * line height or letter spacing, or in its whole composite style. With
 * `shorthand`, as in a block of variants, a value that is not composite
 * paints as `font`, such as `--mui-font-h1`.
 */
export function typographyRow(
  build: SpecimenBuild,
  item: FoundationItem,
  shorthand = false,
): HTMLElement {
  const paint = build.paintOf(item)

  if (item.type === 'typography') {
    return compositeRow(build, item)
  }

  if (shorthand) {
    return build.showRow(item, typeSample(build, { font: paint }))
  }

  if (item.type === 'fontFamily' || item.type === 'fontWeight') {
    const property = item.type === 'fontFamily' ? 'font-family' : 'font-weight'

    return build.showRow(item, typeSample(build, { [property]: paint }))
  }

  const part = typographyPart(item.name)?.part

  if (isFontSize(item, part)) {
    return fontSizeRow(build, item)
  }

  if (part === 'lineHeight') {
    return build.showRow(item, typeSample(build, { 'line-height': paint }, true))
  }

  if (part === 'letterSpacing') {
    return build.showRow(item, typeSample(build, { 'letter-spacing': paint }))
  }

  return build.listRow(item)
}
