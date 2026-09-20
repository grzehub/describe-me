#!/usr/bin/env node
import { parseArgs } from './parse-args.js'
import { runBuild } from './run-build.js'
import { runDev } from './run-dev.js'

const USAGE = `describe-me — living component docs from your tests

  describe-me dev   [--data .describe-me] [--port 6006]   viewer with live updates
  describe-me build [--data .describe-me] [--out describe-me-dist]   static site
`

/** Entry point of the `describe-me` binary. */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.command === 'help') {
    process.stdout.write(USAGE)
    return
  }

  if (options.command === 'build') {
    await runBuild(options.data, options.out)
    return
  }

  await runDev(options.data, options.port)
}

main().catch((error: unknown) => {
  process.stderr.write(`describe-me: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
