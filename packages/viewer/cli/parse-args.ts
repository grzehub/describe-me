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

/** Turn `describe-me <command> [--data dir] [--out dir] [--port n]` into options with defaults. */
export function parseArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseNodeArgs({
    args: argv,
    allowPositionals: true,
    options: {
      data: { type: 'string', default: '.describe-me' },
      out: { type: 'string', default: 'describe-me-dist' },
      port: { type: 'string', default: '6006' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  return {
    command: commandFrom(positionals[0], values.help),
    data: values.data,
    out: values.out,
    port: Number(values.port),
  }
}
