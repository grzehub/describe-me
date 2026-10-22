import type { SpecimenBuild } from './specimen-build.js'

const LETTERS = 'Aa Bb Cc 0123'
const PARAGRAPH =
  'Leading sets the room between lines, so this sample runs over at least two of them.'

/**
 * A sample line painted in `styles`. With `paragraph`, as a line height
 * needs, it is a sentence narrow enough to wrap over two lines or more.
 */
export function typeSample(
  build: SpecimenBuild,
  styles: Record<string, string>,
  paragraph = false,
): HTMLElement {
  const sample = build.painted('p', paragraph ? 'fd-sample fd-paragraph' : 'fd-sample', styles)
  sample.textContent = paragraph ? PARAGRAPH : LETTERS

  return sample
}
