import type { ChangesReport } from './changes-report.js'

/**
 * The text of `changes.json`, so `diff --out`, `build --base` and the
 * endpoint of `dev --base` write the same bytes.
 */
export function changesJson(report: ChangesReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
