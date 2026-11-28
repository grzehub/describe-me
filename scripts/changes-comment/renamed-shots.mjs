import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** The names `describe-me diff --shots` writes, which stay inside a directory and keep a Markdown link whole. */
const SAFE_FILE = /^[A-Za-z0-9_-]{1,64}\.png$/

/**
 * The report with every `tests[].shot.file` renamed to `<name>-<file>`, such
 * as `shadcn-e5e1c5cf428e.png`, and where each renamed image comes from. Two
 * examples can have a test with the same id, so the prefix keeps their images
 * apart. Throws when a name is not safe or its file is missing.
 */
export function renamedShots(report, name, dir) {
  const images = []
  const tests = report.tests.map((test) => {
    if (!test.shot) {
      return test
    }

    const file = test.shot.file

    if (typeof file !== 'string' || !SAFE_FILE.test(file)) {
      throw new Error(
        `${name}/changes.json names the image ${JSON.stringify(file)}, which is no safe file name`,
      )
    }

    const source = join(dir, name, file)

    if (!existsSync(source)) {
      throw new Error(`${name}/changes.json names the image ${file}, which is not in ${name}/`)
    }

    const renamed = `${name}-${file}`
    images.push({ file: renamed, source })

    return { ...test, shot: { ...test.shot, file: renamed } }
  })

  return { report: { ...report, tests }, images }
}
