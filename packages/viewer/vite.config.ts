import { defineConfig, type Plugin } from 'vite'
import { existsSync, readFileSync, statSync, watch } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

/**
 * Serves a `.describe-me` directory under `/__data` and pushes an HMR event
 * whenever the manifest changes. The directory comes from DESCRIBE_ME_DIR.
 */
function describeMeData(): Plugin {
  const dir = resolve(process.env.DESCRIBE_ME_DIR ?? '../../examples/react-basic/.describe-me')
  return {
    name: 'describe-me:data',
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
      } catch (err) {
        server.config.logger.warn(`describe-me: cannot watch ${watchTarget}: ${String(err)}`)
      }

      server.middlewares.use('/__data', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0])
        const abs = join(dir, rel)
        if (!abs.startsWith(dir + sep) || !existsSync(abs) || !statSync(abs).isFile()) {
          return next()
        }

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(readFileSync(abs))
      })
    },
  }
}

export default defineConfig({
  plugins: [describeMeData()],
  server: { port: 6006, strictPort: false, open: false },
})
