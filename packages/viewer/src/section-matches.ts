import type { FoundationSection } from './build-foundations-model.js'

/**
 * The names of a section's tokens that match the token filter, as the
 * sidebar search matches tests: every word of `query` occurs, in any case, in
 * the name or in the raw light or dark value. A pair matches whole when
 * either of its tokens does.
 */
export function sectionMatches(section: FoundationSection, query: string): Set<string> {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const names = new Set<string>()

  for (const block of section.blocks) {
    for (const item of block.items) {
      const fields = [item.name, item.raw.light, item.raw.dark].map((field) => field.toLowerCase())

      if (terms.every((term) => fields.some((field) => field.includes(term)))) {
        names.add(item.name)
      }
    }

    const pairs = block.layout?.kind === 'pairs' ? block.layout.pairs : []

    for (const { background, foreground } of pairs) {
      if (names.has(background) || names.has(foreground)) {
        names.add(background).add(foreground)
      }
    }
  }

  return names
}
