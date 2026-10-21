import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Plugin } from 'vite'

/** The path of the live preview, on its own server and on the viewer's. */
export const LIVE_PATH = '/__describe-me/'

function underLivePath(url: string | undefined): boolean {
  return (url ?? '').startsWith(LIVE_PATH)
}

/** The request's headers for the live server, which only knows its own host. */
function upstreamHeaders(request: IncomingMessage, origin: string): IncomingMessage['headers'] {
  const { host } = new URL(origin)

  return { ...request.headers, host, origin }
}

/** Sends a request on to the live server and the answer back, status, headers and body alike. */
function forward(request: IncomingMessage, response: ServerResponse, origin: string): void {
  const upstream = httpRequest(
    new URL(request.url ?? '/', origin),
    { method: request.method, headers: upstreamHeaders(request, origin) },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.pipe(response)
    },
  )

  upstream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(502)
    }

    response.end()
  })

  request.pipe(upstream)
}

/** The status line and headers of the live server's `101`, for the browser's socket. */
function upgradeHead(answer: IncomingMessage): string {
  const lines = ['HTTP/1.1 101 Switching Protocols']

  for (const [name, value] of Object.entries(answer.headers)) {
    for (const each of Array.isArray(value) ? value : [value]) {
      if (each !== undefined) {
        lines.push(`${name}: ${each}`)
      }
    }
  }

  return `${lines.join('\r\n')}\r\n\r\n`
}

/** Opens the same websocket on the live server and joins the two sockets, Vite's HMR among them. */
function forwardUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  origin: string,
): void {
  const upstream = httpRequest(new URL(request.url ?? '/', origin), {
    method: 'GET',
    headers: upstreamHeaders(request, origin),
  })

  upstream.on('upgrade', (answer, upstreamSocket, upstreamHead) => {
    socket.write(upgradeHead(answer))

    if (upstreamHead.length > 0) {
      socket.write(upstreamHead)
    }

    if (head.length > 0) {
      upstreamSocket.write(head)
    }

    upstreamSocket.pipe(socket).pipe(upstreamSocket)
    upstreamSocket.on('error', () => socket.destroy())
  })

  upstream.on('response', (answer) => {
    socket.end(`HTTP/1.1 ${answer.statusCode ?? 502}\r\n\r\n`)
  })

  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
  upstream.end()
}

/**
 * Serves the live preview under `/__describe-me/` of the viewer's dev server.
 * Every request and every websocket under that path goes to the live server
 * at `origin()`, so the viewer and Live share one port, and one forwarded
 * port, in a container or a web IDE, reaches both. Before the live server is
 * up, `origin()` is undefined and the path answers 503.
 */
export function livePreviewProxy(origin: () => string | undefined): Plugin {
  return {
    name: 'describe-me:live-preview-proxy',

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!underLivePath(request.url)) {
          next()

          return
        }

        const target = origin()

        if (target === undefined) {
          response.writeHead(503, { 'Content-Type': 'text/plain' })
          response.end('The live preview is starting.')

          return
        }

        forward(request, response, target)
      })

      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (!underLivePath(request.url)) {
          return
        }

        const target = origin()

        if (target === undefined) {
          socket.destroy()

          return
        }

        forwardUpgrade(request, socket, head, target)
      })
    },
  }
}
