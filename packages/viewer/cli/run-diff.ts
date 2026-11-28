import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { changesJson } from './changes-json.js'
import type { ChangesReport } from './changes-report.js'
import { changesMarkdown } from './changes-markdown.js'
import { changesSentence } from './changes-sentence.js'
import { changesSummary } from './changes-summary.js'
import { countText } from './count-text.js'
import { diffRuns } from './diff-runs.js'
import { lookSentence } from './look-sentence.js'
import type { DiffRun } from './read-run.js'
import { readRun } from './read-run.js'
import type { ShotImage } from './take-shots.js'
import { takeShots } from './take-shots.js'

/** What `describe-me diff` compares and where it writes. */
export interface RunDiffOptions {
  /** The data directory of the run to compare against. */
  base: string | undefined
  /** The data directory of the current run. */
  data: string
  /** Where `changes.json` and `changes.md` go. Without it the command prints a summary. */
  out: string | undefined
  /** Render the changed frames and write images of those that look different into `out`. */
  shots?: boolean
  /** `--width` as typed: the frame width in CSS pixels. */
  width?: string
  /** `--max-shots` as typed: the most images to write. */
  maxShots?: string
  /** The project to load Playwright from. Default: the `root` of the current run's manifest. */
  root?: string
}

/** The flags of `--shots`, checked. */
interface ShotFlags {
  out: string
  width: number
  maxShots: number
}

const WHOLE_NUMBER = /^[0-9]+$/
const MIN_WIDTH = 200
const MAX_WIDTH = 1920

function shotFlags(options: RunDiffOptions): ShotFlags {
  const width = options.width ?? '480'
  const maxShots = options.maxShots ?? '20'

  if (options.out === undefined) {
    throw new Error('--shots needs --out <dir>, where the images go')
  }

  if (!WHOLE_NUMBER.test(width) || Number(width) < MIN_WIDTH || Number(width) > MAX_WIDTH) {
    throw new Error(
      `--width needs a whole number of CSS pixels from ${MIN_WIDTH} to ${MAX_WIDTH}, got "${width}"`,
    )
  }

  if (!WHOLE_NUMBER.test(maxShots)) {
    throw new Error(`--max-shots needs a whole number from 0, got "${maxShots}"`)
  }

  return { out: options.out, width: Number(width), maxShots: Number(maxShots) }
}

/** `--root`, or else the project the current run's manifest names. */
function projectRoot(root: string | undefined, head: DiffRun): string {
  if (root !== undefined) {
    return resolve(root)
  }

  const named: unknown = head.manifest.root

  return typeof named === 'string' && named !== '' ? resolve(named) : resolve('.')
}

function writeReport(out: string, report: ChangesReport, images: ShotImage[] = []): void {
  mkdirSync(out, { recursive: true })

  for (const image of images) {
    writeFileSync(join(out, image.file), image.png)
  }

  writeFileSync(join(out, 'changes.json'), changesJson(report))
  writeFileSync(join(out, 'changes.md'), changesMarkdown(report))
}

/**
 * Compare two data directories that the reporter wrote and report what
 * changed. It reports and never fails on what it finds: only a manifest or a
 * snapshot that cannot be read throws, and with `shots` a flag out of range
 * or a missing Playwright or Chromium, each before anything is written.
 * `out` is created when missing and never emptied.
 */
export async function runDiff(options: RunDiffOptions): Promise<void> {
  if (options.base === undefined) {
    throw new Error('diff needs --base <dir>, the data directory of the run to compare against')
  }

  const flags = options.shots === true ? shotFlags(options) : undefined
  const base = readRun(options.base)
  const head = readRun(options.data)
  const report = diffRuns(base, head)

  if (options.out === undefined) {
    process.stdout.write(changesSummary(report))
    return
  }

  if (flags === undefined) {
    writeReport(options.out, report)
    process.stdout.write(
      `${changesSentence(report)}\nWrote changes.json and changes.md to ${options.out}.\n`,
    )

    return
  }

  const shots = await takeShots(report, {
    base,
    head,
    width: flags.width,
    maxShots: flags.maxShots,
    root: projectRoot(options.root, head),
  })

  writeReport(flags.out, shots.report, shots.images)

  const sentence = [changesSentence(shots.report), lookSentence(shots.report)]
    .filter((part) => part !== undefined)
    .join(' ')

  process.stdout.write(
    `${sentence}\nWrote changes.json, changes.md and ${countText(shots.images.length, 'image')} to ${flags.out}.\n`,
  )
}
