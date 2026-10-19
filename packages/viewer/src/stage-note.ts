import type { FontFailures } from './fonts-settled.js'
import { state } from './state.js'
import { testView } from './test-view.js'

const MAX_NAMES = 5

function listed(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES).join(', ')
  const rest = names.length - MAX_NAMES

  return rest > 0 ? `${shown} and ${rest} more` : shown
}

/**
 * Name the fonts and stylesheets that did not load in the frame on the stage,
 * and say when the frame has only a light variant to show on the dark canvas.
 * The run's font audit cannot see the failures, because they happen only in
 * this browser. Nothing to say hides the note. The note is a live region, and
 * the stage asks on every resize, so the same text is never written twice.
 */
export function renderStageNote(failures: FontFailures | null, lightOnly: boolean): void {
  const { note } = testView()
  const sentences: string[] = []

  if (failures && failures.families.length > 0) {
    sentences.push(`Fonts that did not load here: ${listed(failures.families)}.`)
  }

  if (failures && failures.stylesheets.length > 0) {
    sentences.push(`Stylesheets that did not load here: ${listed(failures.stylesheets)}.`)
  }

  if (lightOnly) {
    sentences.push('This frame has only a light variant.')
  }

  if (lightOnly && state.manifest?.foundations?.systems.includes('mui')) {
    sentences.push('Material UI records both variants with cssVariables: true.')
  }

  const text = sentences.join(' ')

  if (note.textContent !== text) {
    note.textContent = text
  }

  note.hidden = sentences.length === 0
}
