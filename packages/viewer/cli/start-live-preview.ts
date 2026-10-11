import { LIVE_PROTOCOL } from '@describe-me/core/types'
import { codeOf } from './code-of.js'
import { importCreateLiveServer } from './import-create-live-server.js'
import { LIVE_CONSEQUENCES } from './live-consequences.js'
import type { LivePreviewInfo } from './live-preview-info.js'
import { liveProject } from './live-project.js'
import { reasonOf } from './reason-of.js'

// The code `createLiveServer()` rejects with when the project's config sets `live: false`.
const LIVE_OFF = 'DESCRIBE_ME_LIVE_OFF'

/**
 * Starts the live preview of the project the manifest names, or of `--root`,
 * on a free port. Never throws: a preview that cannot start comes back as
 * `error` with the reason, and one the project's config switches off as `off`.
 */
export async function startLivePreview(
  data: string,
  root: string | undefined,
): Promise<LivePreviewInfo> {
  try {
    const project = liveProject(data, root, LIVE_CONSEQUENCES.dev)
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
    if (codeOf(error) === LIVE_OFF) {
      return { status: 'off' }
    }

    return { status: 'error', error: reasonOf(error) }
  }
}
