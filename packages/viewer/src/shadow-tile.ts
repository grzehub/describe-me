import type { BlockLayout, FoundationItem } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'
import { splitTopLevel } from './split-top-level.js'

type ShadowProperty = Extract<BlockLayout, { kind: 'shadows' }>['property']

/**
 * `drop-shadow()` takes one shadow, so a token of several gets one per part.
 * Those come from its own value, since `var()` cannot be split.
 */
function dropShadows(build: SpecimenBuild, item: FoundationItem): string {
  const parts = splitTopLevel(build.rawOf(item))

  if (parts.length > 1) {
    return parts.map((part) => `drop-shadow(${part})`).join(' ')
  }

  return `drop-shadow(${build.paintOf(item)})`
}

function textShadowTile(build: SpecimenBuild, item: FoundationItem): HTMLElement {
  const element = build.tokenElement(item, 'div', 'fd-tile')
  const sample = build.painted('div', 'fd-text-shadow', { 'text-shadow': build.paintOf(item) })
  sample.textContent = 'Aa'
  element.append(sample, ...build.labels(item))

  return element
}

/**
 * A shadow token's tile: a card under `box-shadow`, a shape under
 * `filter: drop-shadow()` or `Aa` under `text-shadow`. A value the browser
 * cannot use shows as a list row.
 */
export function shadowTile(
  build: SpecimenBuild,
  item: FoundationItem,
  property: ShadowProperty,
): HTMLElement {
  const paint = build.paintOf(item)

  if (property === 'filter') {
    const filter = dropShadows(build, item)

    if (!CSS.supports('filter', filter)) {
      return build.listRow(item)
    }

    return build.tile(item, 'fd-drop', 'filter', filter)
  }

  if (!CSS.supports(property, paint)) {
    return build.listRow(item)
  }

  if (property === 'text-shadow') {
    return textShadowTile(build, item)
  }

  return build.tile(item, 'fd-card', 'box-shadow')
}
