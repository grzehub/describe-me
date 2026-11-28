import type { ChangesReport } from './changes-report.js'

/**
 * The sentence that follows the summary sentence with `--shots`, such as
 * `10 of the changed tests look different.` `undefined` without `--shots`
 * and when no test changed.
 */
export function lookSentence(report: ChangesReport): string | undefined {
  if (report.shots === undefined || report.counts.tests.changed === 0) {
    return undefined
  }

  const different = report.tests.filter(
    (test) => test.change === 'changed' && test.look === 'different',
  ).length

  if (different === 0) {
    return 'None of the changed tests looks different.'
  }

  if (different === 1) {
    return '1 of the changed tests looks different.'
  }

  return `${different} of the changed tests look different.`
}
