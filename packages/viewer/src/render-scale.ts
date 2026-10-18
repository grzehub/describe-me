import type { BlockLayout, FoundationItem, ScaleStep } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'

function pixelText(pixels: number): string {
  return `${Number(pixels.toFixed(2))}px`
}

/**
 * A derived row is not a token. Its length is measured outside the row, so a
 * bar clipped by the row still reports its real length.
 */
function derivedRow(build: SpecimenBuild, base: FoundationItem, { step, label }: ScaleStep) {
  const length = `calc(${build.paintOf(base)} * ${step})`
  const row = build.make('div', 'fd-row fd-derived')
  const meta = build.make('div', 'fd-meta')
  const show = build.make('div', 'fd-show')
  const value = `calc(var(${base.name}) * ${step}) → ${pixelText(build.pixels(length))}`
  row.dataset.step = String(step)
  row.dataset.base = base.name
  meta.append(build.make('span', 'fd-label', label), build.make('span', 'fd-value', value))
  show.append(build.painted('div', 'fd-bar', { width: length }))
  row.append(meta, show)

  return row
}

/** A spacing scale: each token as a bar, and after the base the multiples that utilities use. */
export function renderScale(
  build: SpecimenBuild,
  items: FoundationItem[],
  layout: Extract<BlockLayout, { kind: 'scale' }>,
): HTMLElement {
  const rows = build.make('div', 'fd-rows')

  for (const item of items) {
    const bar = build.painted('div', 'fd-bar', { width: build.paintOf(item) })
    rows.append(build.showRow(item, bar))

    if (item.name === layout.base) {
      rows.append(...layout.steps.map((step) => derivedRow(build, item, step)))
    }
  }

  return rows
}
