import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'

/** The `name` in a directory's package.json, if it has a readable one. */
function packageNameIn(directory: string): unknown {
  const manifest = join(directory, 'package.json')

  if (!existsSync(manifest)) {
    return undefined
  }

  try {
    return (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name
  } catch {
    return undefined
  }
}

/**
 * The directory of the adapter package the project resolves, e.g.
 * `/repo/node_modules/@describe-me/react/`, with posix separators and a
 * trailing slash the way Vite ids look, or null when it cannot be resolved.
 * It is the real path, so a workspace link points at its source directory.
 */
export function adapterPackageRoot(root: string, packageName: string): string | null {
  let entry: string

  // The package does not export `./package.json`, so resolve its entry and walk up.
  try {
    entry = createRequire(join(root, 'package.json')).resolve(packageName)
  } catch {
    return null
  }

  let directory = dirname(entry)

  while (directory !== dirname(directory)) {
    if (packageNameIn(directory) === packageName) {
      return `${directory.split(sep).join('/')}/`
    }

    directory = dirname(directory)
  }

  return null
}
