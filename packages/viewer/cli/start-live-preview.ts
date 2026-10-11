import { LIVE_PROTOCOL } from '@describe-me/core/types'
import { importCreateLiveServer } from './import-create-live-server.js'
import type { LivePreviewInfo } from './live-preview-info.js'
import { liveProject } from './live-project.js'

const PREFIX = 'describe-me: '
// Vite and its bundler colour their errors for the terminal.
const COLOURS = new RegExp(String.raw`\u001b\[[\d;]*m`, 'g')

function reasonOf(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(COLOURS, '')
    .trim()

  return message.startsWith(PREFIX) ? message.slice(PREFIX.length) : message
}

/**
 * Starts the live preview of the project the manifest names, or of `--root`,
 * on a free port. Never throws: a preview that cannot start comes back as
 * `error` with the reason.
 */
export async function startLivePreview(
  data: string,
  root: string | undefined,
): Promise<LivePreviewInfo> {
  try {
    const project = liveProject(data, root)
    const createLiveServer = await importCreateLiveServer(project.root)
    const server = await createLiveServer(project)

    if (server.protocol !== LIVE_PROTOCOL) {
      await server.close().catch(() => undefined)

      return {
        status: 'error',
        error: `all describe-me packages must be on the same version. The live preview in ${project.root} speaks protocol ${server.protocol}, this viewer ${LIVE_PROTOCOL}.`,
      }
    }

    return { status: 'ready', base: server.base }
  } catch (error) {
    return { status: 'error', error: reasonOf(error) }
  }
}
