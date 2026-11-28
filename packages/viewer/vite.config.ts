import { cpSync, existsSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { defineConfig, type Connect, type Plugin } from 'vite'

/** Content types of what the data directory holds: the manifest, snapshots and copied project assets. */
const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

function contentType(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** Where the manifest and snapshots live. The CLI sets this; the default is the example project. */
function dataDir(): string {
  return resolve(process.env.DESCRIBE_ME_DIR ?? '../../examples/react-browser/.describe-me')
}

/** The data directory of the run that `describe-me diff` compares against, when the CLI sets one. */
function baseDir(): string | undefined {
  const base = process.env.DESCRIBE_ME_BASE

  return base ? resolve(base) : undefined
}

/** Serves the files of `dir`, and never one outside it. */
function serveDirectory(dir: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    const relative = decodeURIComponent((request.url ?? '/').split('?')[0])
    const absolute = join(dir, relative)

    if (!absolute.startsWith(dir + sep) || !existsSync(absolute) || !statSync(absolute).isFile()) {
      return next()
    }

    response.setHeader('Content-Type', contentType(absolute))
    response.setHeader('Cache-Control', 'no-store')
    response.end(readFileSync(absolute))
  }
}

/**
 * Dev: serves the data directory under `/__data`, and the base run under
 * `/__base` when the CLI names one, and pushes an HMR event when the manifest
 * changes. Build: copies the data directory into the output, so the result is
 * a self-contained static site.
 */
function describeMeData(): Plugin {
  const dir = dataDir()
  const base = baseDir()
  let outDir = 'dist'
  let command: 'build' | 'serve' = 'serve'

  return {
    name: 'describe-me:data',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      command = config.command
    },

    configureServer(server) {
      server.config.logger.info(`describe-me: serving data from ${dir}`)

      if (base !== undefined) {
        server.config.logger.info(`describe-me: serving the base run from ${base}`)
      }

      let timer: NodeJS.Timeout | undefined
      let watcher: FSWatcher | undefined

      const notify = () => {
        clearTimeout(timer)
        timer = setTimeout(
          () => server.ws.send({ type: 'custom', event: 'describe-me:update' }),
          150,
        )
      }

      const watchTarget = existsSync(dir) ? dir : dirname(dir)

      try {
        watcher = watch(watchTarget, { recursive: true }, (_event, file) => {
          if (!file || String(file).endsWith('manifest.json')) {
            notify()
          }
        })
      } catch (error) {
        server.config.logger.warn(`describe-me: cannot watch ${watchTarget}: ${String(error)}`)
      }

      // A watcher left open keeps the process alive after the CLI closes the server.
      server.httpServer?.once('close', () => {
        clearTimeout(timer)
        watcher?.close()
      })

      server.middlewares.use('/__data', serveDirectory(dir))

      if (base !== undefined) {
        server.middlewares.use('/__base', serveDirectory(base))
      }
    },

    // Vite's dev server runs this hook too when it closes, and must not copy anything.
    closeBundle() {
      if (command !== 'build') {
        return
      }

      if (!existsSync(dir)) {
        this.warn(`describe-me: no data at ${dir}; run vitest first`)
        return
      }

      cpSync(dir, join(outDir, '__data'), { recursive: true })
    },
  }
}

export default defineConfig({
  // Relative asset URLs, so the site works from any sub-path (GitHub Pages, S3 prefixes).
  base: './',
  plugins: [describeMeData()],
  server: { port: 6006, strictPort: false, open: false },
})
