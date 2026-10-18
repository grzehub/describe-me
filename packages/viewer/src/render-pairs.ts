import type { ColorPair, FoundationItem } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'

/** The foreground of a background's tile: a dot of its color and its labels. */
function foregroundElement(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const element = build.tokenElement(item, 'div', 'fd-pair-fg')
  const dot = build.painted('span', 'fd-dot', { 'background-color': build.paintOf(item) })
  const text = build.make('div', 'fd-pair-text')
  text.append(...build.labels(item))
  element.append(dot, text)

  return element
}

/**
 * The tile is one token's element. Its chip paints `Aa` in the foreground on
 * the background, and the frame adds the contrast once values resolve.
 */
function pairTile(
  build: SpecimenBuild,
  pair: ColorPair,
  background: FoundationItem,
  foreground: FoundationItem,
): HTMLElement {
  const owner = pair.tile === 'background' ? background : foreground
  const tile = build.tokenElement(owner, 'div', 'fd-pair')
  const chip = build.painted('div', 'fd-pair-chip', {
    'background-color': build.paintOf(background),
    color: build.paintOf(foreground),
  })

  const contrast = build.make('span', 'fd-contrast')
  tile.dataset.pair = ''
  chip.textContent = 'Aa'
  tile.append(chip, ...build.labels(owner))

  if (pair.tile === 'background') {
    tile.append(foregroundElement(build, foreground))
  }

  tile.append(contrast)
  build.tiles.push({
    tile,
    chip,
    contrast,
    background: build.paintOf(background),
    foreground: build.paintOf(foreground),
  })

  return tile
}

/**
 * A color block with pair tiles: swatches in item order, where the token that
 * owns a pair's tile shows the tile instead. A foreground inside its
 * background's tile shows nowhere else.
 */
export function renderPairs(
  build: SpecimenBuild,
  items: FoundationItem[],
  pairs: ColorPair[],
): HTMLElement {
  const byName = new Map(items.map((item) => [item.name, item]))
  const nested = new Set(
    pairs.filter((pair) => pair.tile === 'background').map((pair) => pair.foreground),
  )

  const owned = new Map(
    pairs.map((pair) => [pair.tile === 'background' ? pair.background : pair.foreground, pair]),
  )

  // A background's tile holds its foreground too, so it needs a wider column.
  const wide = pairs.some((pair) => pair.tile === 'background')
  const grid = build.make('div', wide ? 'fd-swatches fd-pairs' : 'fd-swatches fd-intent')

  for (const item of items) {
    const pair = owned.get(item.name)
    const background = pair ? byName.get(pair.background) : undefined
    const foreground = pair ? byName.get(pair.foreground) : undefined

    if (pair && background && foreground) {
      grid.append(pairTile(build, pair, background, foreground))
    } else if (!nested.has(item.name)) {
      grid.append(build.swatch(item))
    }
  }

  return grid
}
