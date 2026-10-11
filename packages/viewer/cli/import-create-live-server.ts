import { pathToFileURL } from 'node:url'
import { LIVE_CONSEQUENCES } from './live-consequences.js'
import { livePredates } from './live-predates.js'
import type { LiveProject } from './live-project.js'
import { resolveLiveEntry } from './resolve-live-entry.js'

/**
 * The part of the server from `@describe-me/vitest/live` that the CLI uses.
 * Declared here, because `describe-me` does not depend on `@describe-me/vitest`.
 */
export interface LivePreviewServer {
  /** The URL the live page is under. */
  base: string
  /** The live protocol of the project's describeMe() plugin. */
  protocol: number
  close(): Promise<void>
}

/** `createLiveServer()` as the CLI calls it. */
export type CreateLiveServer = (project: LiveProject) => Promise<LivePreviewServer>

/**
 * `createLiveServer()` from the project's own `@describe-me/vitest/live`, so
 * the preview runs the plugin the tests ran with. Throws the reason when the
 * project has none.
 */
export async function importCreateLiveServer(root: string): Promise<CreateLiveServer> {
  const entry = resolveLiveEntry(root, LIVE_CONSEQUENCES.dev)
  const exported: unknown = await import(pathToFileURL(entry).href)
  const create =
    typeof exported === 'object' && exported !== null && 'createLiveServer' in exported
      ? exported.createLiveServer
      : undefined

  if (typeof create !== 'function') {
    throw livePredates(root, 'the live preview', LIVE_CONSEQUENCES.dev)
  }

  return create as CreateLiveServer
}
