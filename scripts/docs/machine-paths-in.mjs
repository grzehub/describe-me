import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'

/** A directory as the bytes to search for: its resolved and its real path, each followed by `/`. */
function needlesOf(dir) {
  const resolved = resolve(dir)
  const spellings = existsSync(resolved) ? [resolved, realpathSync(resolved)] : [resolved]

  return [...new Set(spellings)].map((spelling) => Buffer.from(`${spelling}/`))
}

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

/**
 * Every file under `dir` that names one of `places` or the home directory, so
 * a built site can be checked for paths of the machine that built it.
 * `places` maps a label to a directory, such as `{ 'the checkout': repoRoot }`.
 * Files are read as bytes, binary ones included. Returns how many files were
 * read and one problem per file and place.
 */
export function machinePathsIn(dir, places) {
  const searched = Object.entries(places).map(([label, place]) => [label, needlesOf(place)])
  const home = homedir()

  if (home !== '/') {
    searched.push(['the home directory', needlesOf(home)])
  }

  const files = filesUnder(dir)
  const problems = []

  for (const file of files) {
    const bytes = readFileSync(file)
    const name = relative(dir, file).split(sep).join('/')

    for (const [label, needles] of searched) {
      if (needles.some((needle) => bytes.includes(needle))) {
        problems.push(`${name} names ${label}`)
      }
    }
  }

  return { files: files.length, problems }
}
