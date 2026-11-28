import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { changesJson } from './changes-json.js'
import { diffRuns } from './diff-runs.js'
import { readRun } from './read-run.js'

const PATH = '/__data/changes.json'

/** The answer for one state of both manifests. `body` is `null` when there is no report. */
interface Answer {
  state: string
  body: string | null
}

/** The `mtimeMs` and `size` of a manifest, or `-` when it is missing. */
function stamp(dir: string): string {
  const stats = statSync(join(dir, 'manifest.json'), { throwIfNoEntry: false })

  return stats === undefined ? '-' : `${stats.mtimeMs}:${stats.size}`
}

/**
 * Answers `GET` and `HEAD /__data/changes.json` on the viewer's dev server
 * with the report of `base` against `data`, computed again when either
 * manifest changes. It answers 404 while the current run has no manifest, and
 * when the comparison throws, which it warns about once per state of the
 * manifests. `enforce: 'pre'` puts it before the data directory's files, so
 * a `changes.json` there never wins.
 */
export function changesEndpoint(base: string, data: string): Plugin {
  let last: Answer | undefined

  return {
    name: 'describe-me:changes',
    enforce: 'pre',

    configureServer(server) {
      const answer = (): string | null => {
        const state = `${stamp(base)} ${stamp(data)}`

        if (last?.state === state) {
          return last.body
        }

        last = { state, body: null }

        if (stamp(data) === '-') {
          return null
        }

        try {
          last.body = changesJson(diffRuns(readRun(base), readRun(data)))
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)

          server.config.logger.warn(`describe-me: cannot compare with the base: ${message}`)
        }

        return last.body
      }

      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]
        const readable = request.method === 'GET' || request.method === 'HEAD'

        if (path !== PATH || !readable) {
          next()
          return
        }

        const body = answer()

        response.setHeader('Cache-Control', 'no-store')

        if (body === null) {
          response.statusCode = 404
          response.end()
          return
        }

        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Content-Length', Buffer.byteLength(body))
        response.end(request.method === 'HEAD' ? undefined : body)
      })
    },
  }
}
