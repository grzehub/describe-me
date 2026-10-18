import type { FoundationItem } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'

const LETTERS = 'Aa Bb Cc 0123'
const CAMEL_HUMP = /[A-Z]/g
const FONT_SIZE = /font-?size/i

function kebab(property: string): string {
  return property.replace(CAMEL_HUMP, (letter) => `-${letter.toLowerCase()}`)
}

function partsList(build: SpecimenBuild, parts: Record<string, string>): HTMLElement {
  const text = Object.entries(parts)
    .map(([property, value]) => `${property} ${value}`)
    .join(' · ')

  return build.make('span', 'fd-parts', text)
}

function sample(build: SpecimenBuild, styles: Record<string, string>): HTMLElement {
  const element = build.painted('p', 'fd-sample', styles)
  element.textContent = LETTERS

  return element
}

function isFontSize(item: FoundationItem): boolean {
  const named = item.name.startsWith('--text-') || FONT_SIZE.test(item.name)

  return item.type === 'dimension' && named
}

function compositeRow(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const parts = item.parts ?? {}
  const styles = Object.fromEntries(
    Object.entries(parts).map(([property, value]) => [kebab(property), value]),
  )

  return build.showRow(item, sample(build, styles), partsList(build, parts))
}

function fontSizeRow(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const styles: Record<string, string> = { 'font-size': build.paintOf(item) }

  if (item.parts?.lineHeight) {
    styles['line-height'] = item.parts.lineHeight
  }

  const parts = item.parts ? partsList(build, item.parts) : undefined

  return build.showRow(item, sample(build, styles), parts)
}

/**
 * A typography token's row with a sample line in its family, weight or size,
 * or in its whole composite style. With `shorthand`, as in a block of
 * variants, a value that is not composite paints as `font`, such as
 * `--mui-font-h1`.
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
    return build.showRow(item, sample(build, { font: paint }))
  }

  if (item.type === 'fontFamily' || item.type === 'fontWeight') {
    const property = item.type === 'fontFamily' ? 'font-family' : 'font-weight'

    return build.showRow(item, sample(build, { [property]: paint }))
  }

  if (isFontSize(item)) {
    return fontSizeRow(build, item)
  }

  return build.listRow(item)
}
