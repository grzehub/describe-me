import type { BlockLayout, FoundationItem } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'

const LETTERS = 'Aa Bb Cc 0123'
const PARAGRAPH =
  'Leading sets the room between lines, so this sample runs over at least two of them.'

/**
 * Rows for font weights, tracking or leading, each with a sample in that
 * value and in the theme's sans font when it has one. The leading sample is a
 * paragraph narrow enough to wrap.
 */
export function renderSamples(
  build: SpecimenBuild,
  items: FoundationItem[],
  layout: Extract<BlockLayout, { kind: 'samples' }>,
): HTMLElement {
  const rows = build.make('div', 'fd-rows')
  const wraps = layout.property === 'line-height'
  let font: string | undefined

  if (layout.font) {
    font = build.dark ? layout.font.dark : layout.font.light
  }

  for (const item of items) {
    const styles: Record<string, string> = { [layout.property]: build.paintOf(item) }

    if (font) {
      styles['font-family'] = font
    }

    const sample = build.painted('p', wraps ? 'fd-sample fd-paragraph' : 'fd-sample', styles)
    sample.textContent = wraps ? PARAGRAPH : LETTERS
    rows.append(build.showRow(item, sample))
  }

  return rows
}
