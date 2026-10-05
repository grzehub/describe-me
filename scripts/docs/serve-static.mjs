import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

/**
 * Serve a directory on localhost, the way a static host would. A directory
 * serves its `index.html`, and one asked for without a trailing slash is
 * redirected to it, so relative URLs inside it resolve. Port 0 picks a free
 * port. Resolves with the server and its URL, which ends with `/`.
 */
export function serveStatic(directory, { port = 0 } = {}) {
  const root = resolve(directory)
  const rootPrefix = root.endsWith(sep) ? root : root + sep
  const server = createServer((request, response) => {
    try {
      respond(rootPrefix, request, response)
    } catch {
      send(response, 500, 'Internal error')
    }
  })

  return new Promise((resolveServer, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolveServer({ server, url: `http://localhost:${server.address().port}/` })
    })
  })
}

function respond(rootPrefix, request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Method not allowed')

    return
  }

  const target = request.url ?? '/'
  const queryStart = target.indexOf('?')
  const path = queryStart < 0 ? target : target.slice(0, queryStart)
  const query = queryStart < 0 ? '' : target.slice(queryStart)
  const pathname = decodedPath(path)

  if (pathname === null) {
    send(response, 400, 'Bad request')

    return
  }

  const file = resolve(
    rootPrefix,
    `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`,
  )

  // Checked on the resolved path, so `..` in any spelling cannot leave the directory.
  if (!file.startsWith(rootPrefix)) {
    send(response, 403, 'Forbidden')

    return
  }

  const stats = statOrNull(file)

  if (stats === null) {
    send(response, 404, 'Not found')

    return
  }

  if (stats.isDirectory()) {
    // Relative, so the browser lands on the same path with the slash, and a path such as
    // `//host` cannot send it to another site.
    const name = path.slice(path.lastIndexOf('/') + 1)
    response.writeHead(301, { Location: `./${name}/${query}` })
    response.end()

    return
  }

  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': 'no-cache',
  })

  if (request.method === 'HEAD') {
    response.end()

    return
  }

  createReadStream(file).pipe(response)
}

/** The path of a request URL, percent-decoded, or `null` when it is not a usable path. */
function decodedPath(path) {
  try {
    const decoded = decodeURIComponent(path)

    return decoded.startsWith('/') && !decoded.includes('\0') ? decoded : null
  } catch {
    return null
  }
}

function statOrNull(file) {
  try {
    return statSync(file)
  } catch {
    return null
  }
}

function send(response, status, text) {
  if (response.headersSent) {
    response.destroy()

    return
  }

  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(`${text}\n`)
}
