import type { FontFailures } from './fonts-settled.js'
import { testView } from './test-view.js'

const MAX_NAMES = 5

function listed(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES).join(', ')
  const rest = names.length - MAX_NAMES

  return rest > 0 ? `${shown} and ${rest} more` : shown
}

/**
 * Name the fonts and stylesheets that did not load in the frame on the stage.
 * The run's font audit cannot see them, because they fail only in this browser.
 * `null` or nothing failed hides the note.
 */
export function renderStageNote(failures: FontFailures | null): void {
  const { note } = testView()
  const sentences: string[] = []

  if (failures && failures.families.length > 0) {
    sentences.push(`Fonts that did not load here: ${listed(failures.families)}.`)
  }

  if (failures && failures.stylesheets.length > 0) {
    sentences.push(`Stylesheets that did not load here: ${listed(failures.stylesheets)}.`)
  }

  note.textContent = sentences.join(' ')
  note.hidden = sentences.length === 0
}
