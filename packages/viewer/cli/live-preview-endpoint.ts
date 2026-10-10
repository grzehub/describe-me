import type { Plugin } from 'vite'
import type { LivePreviewInfo } from './live-preview-info.js'

const PATH = '/__live.json'

/**
 * Answers `GET` and `HEAD /__live.json` on the viewer's dev server with what
 * `info()` says at that moment. It is an inline plugin of the CLI, because
 * the viewer's `vite.config.ts` cannot see the CLI's state.
 */
export function livePreviewEndpoint(info: () => LivePreviewInfo): Plugin {
  return {
    name: 'describe-me:live-preview',

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]
        const readable = request.method === 'GET' || request.method === 'HEAD'

        if (path !== PATH || !readable) {
          next()
          return
        }

        const body = JSON.stringify(info())

        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Content-Length', Buffer.byteLength(body))
        response.end(request.method === 'HEAD' ? undefined : body)
      })
    },
  }
}
