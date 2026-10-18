import type { FoundationGroup } from '@describe-me/core/types'
import type { FoundationBlock, FoundationItem } from './build-foundations-model.js'
import { renderPairs } from './render-pairs.js'
import { renderPalette } from './render-palette.js'
import { renderRamp } from './render-ramp.js'
import { renderSamples } from './render-samples.js'
import { renderScale } from './render-scale.js'
import { shadowTile } from './shadow-tile.js'
import type { SpecimenBuild } from './specimen-build.js'
import { typographyRow } from './typography-row.js'

function breakpointRows(build: SpecimenBuild, items: FoundationItem[]): HTMLElement[] {
  const widths = items.map((item) => build.pixels(build.paintOf(item)))
  const widest = Math.max(0, ...widths)

  return items.map((item, i) => {
    const share = widest > 0 ? ((widths[i] ?? 0) / widest) * 100 : 0
    const bar = build.painted('div', 'fd-bar', { width: `${share}%` })

    return build.showRow(item, bar)
  })
}

function shadowTiles(
  build: SpecimenBuild,
  items: FoundationItem[],
  property: 'box-shadow' | 'filter' | 'text-shadow',
): HTMLElement {
  const grid = build.make('div', 'fd-tiles fd-shadows')
  grid.append(...items.map((item) => shadowTile(build, item, property)))

  return grid
}

function rowsOf(build: SpecimenBuild, rows: HTMLElement[]): HTMLElement {
  const container = build.make('div', 'fd-rows')
  container.append(...rows)

  return container
}

/** The layout of a block that has none of its own, by its section. */
function sectionLayout(build: SpecimenBuild, section: FoundationGroup, items: FoundationItem[]) {
  if (section === 'colors') {
    const grid = build.make('div', 'fd-swatches')
    grid.append(...items.map((item) => build.swatch(item)))

    return grid
  }

  if (section === 'shadows') {
    return shadowTiles(build, items, 'box-shadow')
  }

  if (section === 'radius') {
    const grid = build.make('div', 'fd-tiles')
    grid.append(...items.map((item) => build.tile(item, 'fd-box', 'border-radius')))

    return grid
  }

  if (section === 'breakpoints') {
    return rowsOf(build, breakpointRows(build, items))
  }

  if (section === 'typography') {
    return rowsOf(
      build,
      items.map((item) => typographyRow(build, item)),
    )
  }

  if (section === 'spacing') {
    const bars = items.map((item) =>
      build.showRow(item, build.painted('div', 'fd-bar', { width: build.paintOf(item) })),
    )

    return rowsOf(build, bars)
  }

  return rowsOf(
    build,
    items.map((item) => build.listRow(item)),
  )
}

function container(build: SpecimenBuild, section: FoundationGroup, block: FoundationBlock) {
  const { layout, items } = block

  if (layout?.kind === 'pairs') {
    return renderPairs(build, items, layout.pairs)
  }

  if (layout?.kind === 'ramp') {
    return renderRamp(build, items)
  }

  if (layout?.kind === 'palette') {
    return renderPalette(build, items, layout.rows)
  }

  if (layout?.kind === 'scale') {
    return renderScale(build, items, layout)
  }

  if (layout?.kind === 'samples') {
    return renderSamples(build, items, layout)
  }

  if (layout?.kind === 'shadows') {
    return shadowTiles(build, items, layout.property)
  }

  if (layout?.kind === 'variants') {
    return rowsOf(
      build,
      items.map((item) => typographyRow(build, item, true)),
    )
  }

  return sectionLayout(build, section, items)
}

/** Text between backticks shows as code. */
function noteOf(build: SpecimenBuild, text: string): HTMLElement {
  const note = build.make('p', 'fd-note')

  text.split('`').forEach((part, i) => {
    if (part !== '') {
      note.append(i % 2 === 1 ? build.make('code', 'fd-code', part) : part)
    }
  })

  return note
}

/** The title, its prefix, the count, a badge on a block of defaults, and the note under them. */
function header(build: SpecimenBuild, block: FoundationBlock): HTMLElement[] {
  const title = build.make('h2', 'fd-block-title', block.title)

  if (block.prefix) {
    title.append(build.make('span', 'fd-prefix', block.prefix))
  }

  title.append(build.make('span', 'fd-count', String(block.items.length)))

  if (block.defaults) {
    title.append(build.badge())
  }

  return block.note ? [title, noteOf(build, block.note)] : [title]
}

/**
 * One block of a section inside the specimen frame: its header, then its
 * items in the block's layout, or in its section's layout when it has none.
 */
export function renderSpecimenBlock(
  build: SpecimenBuild,
  section: FoundationGroup,
  block: FoundationBlock,
): HTMLElement {
  const element = build.make('section', 'fd-block')
  element.dataset.block = block.id
  element.append(...header(build, block), container(build, section, block))

  return element
}
