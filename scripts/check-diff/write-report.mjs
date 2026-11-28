import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** A 1 × 1 PNG, which stands in for an image of `--shots`. */
const DUMMY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * A `describe-me diff --out` directory at `dir` with `report` as its
 * `changes.json` and a dummy PNG for every `shot` it names.
 */
export function writeReport(dir, report) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'changes.json'), `${JSON.stringify(report, null, 2)}\n`)

  for (const test of report.tests) {
    if (test.shot !== undefined) {
      writeFileSync(join(dir, test.shot.file), DUMMY_PNG)
    }
  }
}
