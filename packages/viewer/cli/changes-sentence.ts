import type { ChangesReport } from './changes-report.js'
import { countText } from './count-text.js'
import { isCssOnly } from './is-css-only.js'
import { listText } from './list-text.js'

/**
 * The one sentence that sums up a report, such as `10 of 16 tests changed (6
 * only in CSS), 1 added, 1 removed and 1 moved.` It counts the tests of the
 * head and holds no name from a manifest, so it needs no escaping.
 */
export function changesSentence(report: ChangesReport): string {
  const { changed, added, removed, moved, unchanged } = report.counts.tests
  const compared = changed + added + moved + unchanged

  if (report.tests.length === 0 && report.components.length === 0) {
    return `Nothing changed against the base. ${countText(compared, 'test')} compared.`
  }

  const cssOnly = report.tests.filter(isCssOnly).length
  let first = `${changed} of ${countText(compared, 'test')} changed`

  if (cssOnly > 0) {
    first += ` (${cssOnly} only in CSS)`
  }

  const parts = [first]

  for (const [count, word] of [
    [added, 'added'],
    [removed, 'removed'],
    [moved, 'moved'],
  ] as const) {
    if (count > 0) {
      parts.push(`${count} ${word}`)
    }
  }

  const sentence = `${listText(parts)}.`

  if (report.components.length === 0) {
    return sentence
  }

  return `${sentence} The props of ${countText(report.components.length, 'component')} changed.`
}
