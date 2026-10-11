import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { LiveProject } from './live-project.js'

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

function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

function predates(root: string): Error {
  return new Error(
    `the @describe-me/vitest in ${root} predates the live preview, so the viewer runs without Live.`,
  )
}

function notFound(root: string): Error {
  return new Error(
    `cannot find @describe-me/vitest from ${root}, so the viewer runs without Live. Pass --root with the project directory.`,
  )
}

/** Whether `node_modules/@describe-me/vitest` is in `root` or a directory above it. */
function isInstalledFrom(root: string): boolean {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', '@describe-me', 'vitest', 'package.json'))) {
      return true
    }

    if (dirname(dir) === dir) {
      return false
    }
  }
}

/** The file `@describe-me/vitest/live` resolves to from the project root. */
function resolveLiveEntry(root: string): string {
  // The bin shims of package managers put their own store on NODE_PATH, which
  // `resolve()` searches too. Only the project's own node_modules count.
  if (!isInstalledFrom(root)) {
    throw notFound(root)
  }

  try {
    return createRequire(join(root, 'package.json')).resolve('@describe-me/vitest/live')
  } catch (error) {
    if (codeOf(error) === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      throw predates(root)
    }

    if (codeOf(error) === 'MODULE_NOT_FOUND') {
      throw notFound(root)
    }

    throw error
  }
}

/**
 * `createLiveServer()` from the project's own `@describe-me/vitest/live`, so
 * the preview runs the plugin the tests ran with. Throws the reason when the
 * project has none.
 */
export async function importCreateLiveServer(root: string): Promise<CreateLiveServer> {
  const entry = resolveLiveEntry(root)
  const exported: unknown = await import(pathToFileURL(entry).href)
  const create =
    typeof exported === 'object' && exported !== null && 'createLiveServer' in exported
      ? exported.createLiveServer
      : undefined

  if (typeof create !== 'function') {
    throw predates(root)
  }

  return create as CreateLiveServer
}
