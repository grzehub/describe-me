import type { FoundationGroup } from '@describe-me/core/types'
import { FOUNDATION_SECTIONS } from './foundation-sections.js'

/**
 * The section a link's `foundations` names. Without the parameter it is
 * `null`. Any text that names no section is `'colors'`, which the view then
 * corrects to the first section with tokens.
 */
export function parseFoundationsSection(text: string | null): FoundationGroup | null {
  if (text === null) {
    return null
  }

  const section = FOUNDATION_SECTIONS.find((candidate) => candidate.id === text)

  return section?.id ?? 'colors'
}
