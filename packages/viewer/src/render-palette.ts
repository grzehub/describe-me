import type { FoundationItem, PaletteRow } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'

function chip(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const element = build.tokenElement(item, 'span', 'fd-pchip')
  element.title = `${item.name}: ${build.rawOf(item)}`
  element.append(
    build.painted('span', 'fd-pchip-paint', { 'background-color': build.paintOf(item) }),
  )

  return element
}

/**
 * A compact palette of framework defaults: one row per family with its name,
 * then small chips without labels. Each chip names its token and value in
 * `title`, and the rows wrap rather than overflow.
 */
export function renderPalette(
  build: SpecimenBuild,
  items: FoundationItem[],
  rows: PaletteRow[],
): HTMLElement {
  const byName = new Map(items.map((item) => [item.name, item]))
  const palette = build.make('div', 'fd-palette')

  for (const row of rows) {
    const line = build.make('div', 'fd-prow')
    const chips = build.make('div', 'fd-pchips')

    for (const name of row.names) {
      const item = byName.get(name)

      if (item) {
        chips.append(chip(build, item))
      }
    }

    line.append(build.make('span', 'fd-family', row.label), chips)
    palette.append(line)
  }

  return palette
}
