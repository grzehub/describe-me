import { cpSync, existsSync, readFileSync, statSync, watch } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

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

/**
 * Dev: serves the data directory under `/__data` and pushes an HMR event when
 * the manifest changes. Build: copies the data directory into the output, so
 * the result is a self-contained static site.
 */
function describeMeData(): Plugin {
  const dir = dataDir()
  let outDir = 'dist'

  return {
    name: 'describe-me:data',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },

    configureServer(server) {
      server.config.logger.info(`describe-me: serving data from ${dir}`)

      let timer: NodeJS.Timeout | undefined

      const notify = () => {
        clearTimeout(timer)
        timer = setTimeout(
          () => server.ws.send({ type: 'custom', event: 'describe-me:update' }),
          150,
        )
      }

      const watchTarget = existsSync(dir) ? dir : dirname(dir)

      try {
        watch(watchTarget, { recursive: true }, (_event, file) => {
          if (!file || String(file).endsWith('manifest.json')) {
            notify()
          }
        })
      } catch (error) {
        server.config.logger.warn(`describe-me: cannot watch ${watchTarget}: ${String(error)}`)
      }

      server.middlewares.use('/__data', (request, response, next) => {
        const relative = decodeURIComponent((request.url ?? '/').split('?')[0])
        const absolute = join(dir, relative)

        if (
          !absolute.startsWith(dir + sep) ||
          !existsSync(absolute) ||
          !statSync(absolute).isFile()
        ) {
          return next()
        }

        response.setHeader('Content-Type', contentType(absolute))
        response.setHeader('Cache-Control', 'no-store')
        response.end(readFileSync(absolute))
      })
    },

    closeBundle() {
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
