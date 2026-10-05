/**
 * Serves the built site/ over HTTP, which the example viewers need: they are
 * module scripts that fetch their data, and neither works from `file://`.
 * Build the site first with `pnpm site:build`.
 *
 * Usage: `node scripts/serve-site.mjs [--port 6060]`
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { exampleNames } from './docs/example-names.mjs'
import { repoRoot } from './docs/repo-root.mjs'
import { serveStatic } from './docs/serve-static.mjs'

const SITE = join(repoRoot, 'site')

const { values } = parseArgs({ options: { port: { type: 'string', default: '6060' } } })
const port = Number(values.port)

if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error(`site:serve: --port must be a port number, not ${values.port}`)
  process.exit(1)
}

if (!existsSync(join(SITE, 'index.html'))) {
  console.error('site:serve: there is no site/ yet. Run pnpm site:build first')
  process.exit(1)
}

try {
  const { url } = await serveStatic(SITE, { port })

  console.log(`site:serve: ${url}`)

  for (const name of exampleNames) {
    console.log(`site:serve: ${url}examples/${name}/`)
  }

  console.log('site:serve: press Ctrl+C to stop')
} catch (error) {
  const busy = error?.code === 'EADDRINUSE'

  console.error(
    busy
      ? `site:serve: port ${port} is in use. Pass another with --port`
      : `site:serve: ${error instanceof Error ? error.message : String(error)}`,
  )

  process.exit(1)
}
