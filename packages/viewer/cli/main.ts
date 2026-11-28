import { parseArgs } from './parse-args.js'
import { runBuild } from './run-build.js'
import { runDev } from './run-dev.js'
import { runDiff } from './run-diff.js'

const USAGE = `describe-me — living component docs from your tests

  describe-me dev   [--data .describe-me] [--port 6006] [--no-live] [--root <dir>]   viewer that follows the test runs, and the live preview
  describe-me build [--data .describe-me] [--out describe-me-dist] [--no-vendor-fonts] [--live] [--root <dir>]   static site
  describe-me diff  --base <dir> [--data .describe-me] [--out <dir> [--shots] [--width 480] [--max-shots 20] [--root <dir>]]   what changed against a base run
`

/** Entry point of the `describe-me` binary. */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.command === 'help') {
    process.stdout.write(USAGE)
    return
  }

  if (options.command === 'build') {
    // parseArgs gives `build` its default `out`.
    await runBuild(options.data, options.out as string, {
      vendorFonts: options.vendorFonts,
      live: options.live,
      root: options.root,
    })

    return
  }

  if (options.command === 'diff') {
    await runDiff({
      base: options.base,
      data: options.data,
      out: options.out,
      shots: options.shots,
      width: options.width,
      maxShots: options.maxShots,
      root: options.root,
    })

    return
  }

  await runDev(options.data, options.port, { live: options.live, root: options.root })
}

main().catch((error: unknown) => {
  process.stderr.write(`describe-me: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
