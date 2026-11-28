import { parseArgs as parseNodeArgs } from 'node:util'

export type Command = 'dev' | 'build' | 'diff' | 'help'

export interface CliOptions {
  command: Command
  /** Directory written by the reporter. */
  data: string
  /** Output directory: the site for `build`, `changes.json` and `changes.md` for `diff`. */
  out: string | undefined
  /**
   * `dev`, `build` and `diff`: the data directory of the run to compare
   * against. `diff` needs it, and `dev` and `build` show the changes in the viewer.
   */
  base: string | undefined
  /** Port for `dev`. */
  port: number
  /** `build`: download web fonts from known font hosts into the site. */
  vendorFonts: boolean
  /**
   * `dev`: start the live preview next to the viewer. `build`: build it into
   * the site. On for `dev` and off for `build`, unless `--live` or `--no-live` says otherwise.
   */
  live: boolean
  /**
   * `dev` and `build --live`: the project root of the live preview, instead of
   * the manifest's root and config file. `diff --shots`: the project to load
   * Playwright from, instead of the manifest's root.
   */
  root: string | undefined
  /** `diff`: render the changed frames and write images of those that look different. */
  shots: boolean
  /** `diff --shots`: the frame width in CSS pixels, as typed, so an error can quote it. */
  width: string
  /** `diff --shots`: the most images to write, as typed, so an error can quote it. */
  maxShots: string
}

function commandFrom(positional: string | undefined, help: boolean): Command {
  if (help || positional === undefined) {
    return 'help'
  }

  if (positional === 'build') {
    return 'build'
  }

  if (positional === 'diff') {
    return 'diff'
  }

  return 'dev'
}

/**
 * Turn `describe-me <command> [--data dir] [--out dir] [--base dir] [--port n]
 * [--no-vendor-fonts] [--live | --no-live] [--root dir] [--shots] [--width n]
 * [--max-shots n]` into options with defaults. `out` is `describe-me-dist`
 * for `build` and has no default for `diff`. A command ignores the flags of
 * the others: `build` ignores `--port`, `dev` and `build` ignore `--shots`,
 * `--width` and `--max-shots`, `build` ignores `--root` without `--live`, and
 * `diff` without `--shots` ignores `--width`, `--max-shots` and `--root`.
 */
export function parseArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseNodeArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      data: { type: 'string', default: '.describe-me' },
      out: { type: 'string' },
      base: { type: 'string' },
      port: { type: 'string', default: '6006' },
      help: { type: 'boolean', short: 'h', default: false },
      'vendor-fonts': { type: 'boolean', default: true },
      live: { type: 'boolean' },
      root: { type: 'string' },
      shots: { type: 'boolean', default: false },
      width: { type: 'string', default: '480' },
      'max-shots': { type: 'string', default: '20' },
    },
  })

  const command = commandFrom(positionals[0], values.help)

  return {
    command,
    data: values.data,
    out: values.out ?? (command === 'build' ? 'describe-me-dist' : undefined),
    base: values.base,
    port: Number(values.port),
    vendorFonts: values['vendor-fonts'],
    live: values.live ?? command === 'dev',
    root: values.root,
    shots: values.shots,
    width: values.width,
    maxShots: values['max-shots'],
  }
}
