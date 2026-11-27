import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { changesMarkdown } from './changes-markdown.js'
import { changesSentence } from './changes-sentence.js'
import { changesSummary } from './changes-summary.js'
import { diffRuns } from './diff-runs.js'
import { readRun } from './read-run.js'

/** What `describe-me diff` compares and where it writes. */
export interface RunDiffOptions {
  /** The data directory of the run to compare against. */
  base: string | undefined
  /** The data directory of the current run. */
  data: string
  /** Where `changes.json` and `changes.md` go. Without it the command prints a summary. */
  out: string | undefined
}

/**
 * Compare two data directories that the reporter wrote and report what
 * changed. It reports and never fails on what it finds: only a manifest or a
 * snapshot that cannot be read throws. `out` is created when missing and
 * never emptied.
 */
export function runDiff(options: RunDiffOptions): void {
  if (options.base === undefined) {
    throw new Error('diff needs --base <dir>, the data directory of the run to compare against')
  }

  const report = diffRuns(readRun(options.base), readRun(options.data))

  if (options.out === undefined) {
    process.stdout.write(changesSummary(report))
    return
  }

  mkdirSync(options.out, { recursive: true })
  writeFileSync(join(options.out, 'changes.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(options.out, 'changes.md'), changesMarkdown(report))
  process.stdout.write(
    `${changesSentence(report)}\nWrote changes.json and changes.md to ${options.out}.\n`,
  )
}
