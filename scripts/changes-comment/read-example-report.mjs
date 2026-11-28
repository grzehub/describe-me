import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The `changes.json` that `describe-me diff --out` wrote for one example into
 * `<dir>/<name>/`. Throws with a reason that names the example when the file
 * is missing, cannot be read, is not JSON or is no report of version 1.
 */
export function readExampleReport(dir, name) {
  const file = join(dir, name, 'changes.json')

  if (!existsSync(file)) {
    throw new Error(`${name} has no changes.json in ${join(dir, name)}`)
  }

  let text

  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    throw new Error(`cannot read ${name}/changes.json: ${error.message}`)
  }

  let report

  try {
    report = JSON.parse(text)
  } catch {
    throw new Error(`${name}/changes.json is not valid JSON`)
  }

  if (report?.version !== 1 || !Array.isArray(report.tests) || !Array.isArray(report.components)) {
    throw new Error(`${name}/changes.json is no describe-me diff report of version 1`)
  }

  return report
}
