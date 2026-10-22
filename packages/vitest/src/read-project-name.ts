import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** The `name` of a package.json, or `undefined` when the file has none that is a string. */
function packageName(file: string): string | undefined {
  try {
    const { name } = JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown }

    return typeof name === 'string' && name !== '' ? name : undefined
  } catch {
    return undefined
  }
}

/**
 * The name of the project at `root`, for the manifest's `project`: the `name`
 * of the nearest package.json at or above the root, else the root directory's
 * name. The viewer's header and tab title show it.
 */
export function readProjectName(root: string): string {
  let dir = root

  while (true) {
    const file = join(dir, 'package.json')
    const name = existsSync(file) ? packageName(file) : undefined

    if (name !== undefined) {
      return name
    }

    const parent = dirname(dir)

    if (parent === dir) {
      return basename(root)
    }

    dir = parent
  }
}
