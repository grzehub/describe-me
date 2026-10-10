import type { Vite } from 'vitest/node'
import { livePageHtml } from './live-page-html.js'

const PAGE_PATH = '/__describe-me/live.html'

/**
 * Serves the live page. It goes through Vite's HTML transforms, so that
 * `@vitejs/plugin-react` adds its React Refresh preamble.
 */
export function livePageMiddleware(
  server: Vite.ViteDevServer,
  previewHead: string | undefined,
): Vite.Connect.NextHandleFunction {
  const html = livePageHtml(previewHead)

  return (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const method = request.method ?? 'GET'
    const isPage = url.pathname === PAGE_PATH && (method === 'GET' || method === 'HEAD')

    // Vite serves the page's inline module scripts, such as React Refresh's, under the same path.
    if (!isPage || url.searchParams.has('html-proxy')) {
      next()

      return
    }

    server.transformIndexHtml(url.pathname, html).then(
      (page) => {
        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(method === 'HEAD' ? undefined : page)
      },
      (error: unknown) => next(error),
    )
  }
}
