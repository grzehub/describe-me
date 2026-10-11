import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { adapterPackageRoot } from './adapter-package-root.js'

/** A setup file of the live page, as the generated entry imports it. */
export interface LiveSetupFile {
  /** How messages name it: its path from the root for a file inside the root, else the entry as written. */
  name: string
  /** What the entry imports: `/<path from the root>`, an absolute path, or a package specifier. */
  specifier: string
  /** The file, with `/` separators. Absent for a package. */
  file?: string
}

const OWN_PACKAGE = '@describe-me/vitest'

function posix(path: string): string {
  return path.split(sep).join('/')
}

/** Vitest takes `vitest.setup.ts` without `./`, so a file under the root counts as a path too. */
function isPath(entry: string, root: string): boolean {
  return (
    entry.startsWith('.') ||
    entry.startsWith('/') ||
    isAbsolute(entry) ||
    existsSync(resolve(root, entry))
  )
}

function isOwnPackage(specifier: string): boolean {
  return specifier === OWN_PACKAGE || specifier.startsWith(`${OWN_PACKAGE}/`)
}

/** Whether a file lies in the installed `@describe-me/vitest`, through a link or not. */
function isOwnFile(file: string, ownRoot: string | null): boolean {
  if (ownRoot === null) {
    return false
  }

  const real = existsSync(file) ? posix(realpathSync(file)) : file

  return file.startsWith(ownRoot) || real.startsWith(ownRoot)
}

function fileEntry(entry: string, root: string): LiveSetupFile {
  const file = resolve(root, entry)
  const fromRoot = relative(root, file)
  const inRoot = fromRoot !== '' && !fromRoot.startsWith('..') && !isAbsolute(fromRoot)

  if (inRoot) {
    return { name: posix(fromRoot), specifier: `/${posix(fromRoot)}`, file: posix(file) }
  }

  return { name: entry, specifier: posix(file), file: posix(file) }
}

/**
 * The setup files of the live page, in the order given. Paths resolve
 * against the root, package specifiers stay bare. describe-me's own setup
 * files are left out, because they record and the live page does not.
 */
export function liveSetupFiles(entries: string[], root: string): LiveSetupFile[] {
  const ownRoot = adapterPackageRoot(root, OWN_PACKAGE)
  const setupFiles: LiveSetupFile[] = []

  for (const entry of entries) {
    if (!isPath(entry, root)) {
      if (!isOwnPackage(entry)) {
        setupFiles.push({ name: entry, specifier: entry })
      }

      continue
    }

    const setupFile = fileEntry(entry, root)

    if (!isOwnFile(setupFile.file ?? '', ownRoot)) {
      setupFiles.push(setupFile)
    }
  }

  return setupFiles
}
