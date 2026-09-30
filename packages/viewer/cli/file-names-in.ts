import { existsSync, readdirSync } from 'node:fs'

/** The sorted names of the regular files in `dir` that end in `extension`, none when it is missing. */
export function fileNamesIn(dir: string, extension: string): string[] {
  if (!existsSync(dir)) {
    return []
  }

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort()
}
