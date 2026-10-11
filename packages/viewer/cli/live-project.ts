import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Manifest } from '@describe-me/core/types'

/** The project the live preview runs, as `createLiveServer()` and `buildLive()` take it. */
export interface LiveProject {
  /** The project root. */
  root: string
  /** The Vitest config file, relative to `root`. Absent: the one Vitest picks there. */
  configFile?: string
}

/**
 * The project of the live preview. `--root` replaces both the root and the
 * config file of the manifest, so the preview uses the config Vitest picks in
 * that directory. Throws the reason, followed by `consequence`, when there is
 * neither.
 */
export function liveProject(
  data: string,
  root: string | undefined,
  consequence: string,
): LiveProject {
  if (root !== undefined) {
    return { root: resolve(root) }
  }

  const dir = resolve(data)
  const file = join(dir, 'manifest.json')

  if (!existsSync(file)) {
    throw new Error(
      `no manifest in ${dir} to find the project by, ${consequence}. Run the tests and start again, or pass --root.`,
    )
  }

  let manifest: Pick<Manifest, 'root' | 'configFile'>

  try {
    manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    throw new Error(`cannot read ${file} (${message}), ${consequence}.`)
  }

  const { root: projectRoot, configFile } = manifest

  if (configFile !== undefined && !existsSync(resolve(projectRoot, configFile))) {
    throw new Error(
      `the manifest names the config file ${configFile}, which is not in ${projectRoot}, ${consequence}. Run the tests again, or pass --root.`,
    )
  }

  return { root: projectRoot, configFile }
}
