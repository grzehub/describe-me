import { parseArgs as parseNodeArgs } from 'node:util'

export type Command = 'dev' | 'build' | 'help'

export interface CliOptions {
  command: Command
  /** Directory written by the reporter. */
  data: string
  /** Output directory for `build`. */
  out: string
  /** Port for `dev`. */
  port: number
  /** `build`: download web fonts from known font hosts into the site. */
  vendorFonts: boolean
  /** `dev`: start the live preview next to the viewer. */
  live: boolean
  /** `dev`: the project root of the live preview, instead of the manifest's root and config file. */
  root: string | undefined
}

function commandFrom(positional: string | undefined, help: boolean): Command {
  if (help || positional === undefined) {
    return 'help'
  }

  if (positional === 'build') {
    return 'build'
  }

  return 'dev'
}

/**
 * Turn `describe-me <command> [--data dir] [--out dir] [--port n] [--no-vendor-fonts]
 * [--no-live] [--root dir]` into options with defaults. `build` ignores `--port`,
 * `--no-live` and `--root`.
 */
export function parseArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseNodeArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      data: { type: 'string', default: '.describe-me' },
      out: { type: 'string', default: 'describe-me-dist' },
      port: { type: 'string', default: '6006' },
      help: { type: 'boolean', short: 'h', default: false },
      'vendor-fonts': { type: 'boolean', default: true },
      live: { type: 'boolean', default: true },
      root: { type: 'string' },
    },
  })

  return {
    command: commandFrom(positionals[0], values.help),
    data: values.data,
    out: values.out,
    port: Number(values.port),
    vendorFonts: values['vendor-fonts'],
    live: values.live,
    root: values.root,
  }
}
