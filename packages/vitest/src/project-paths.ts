import { existsSync, realpathSync } from 'node:fs'
import { parse, posix, resolve } from 'node:path'

/** Characters that end a path in free text. */
const PATH_END = String.raw`\s"'\x60()[\]<>,`

/** What may come right before a path: the start of the text or a character that opens one. */
const PATH_START = String.raw`(?<=^|[\s"'\x60(\[=,@])`

/** What a URL puts before a file's path: `file://`, or an HTTP origin and Vite's optional `/@fs`, or `/@fs` alone. */
const URL_LEAD = String.raw`(?:(?:file:\/\/|https?:\/\/[\w.-]+(?::\d+)?)(?:\/@fs)?|\/@fs)?`

/** A `:line` or `:line:column`, which a stack keeps after the file. */
const FILE_SUFFIX = /(?::\d+){1,2}$/

/** A machine prefix one segment deep, such as `/home` or `/tmp`, is shared by every machine. */
const MIN_PREFIX_DEPTH = 2

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/')
}

function depthOf(path: string): number {
  return path
    .slice(parse(path).root.length)
    .split(/[\\/]/)
    .filter((segment) => segment !== '').length
}

/** The path and its ancestors, from the deepest. */
function selfAndAncestors(path: string): string[] {
  const paths = [path]

  for (let parent = posix.dirname(path); parent !== paths.at(-1); parent = posix.dirname(parent)) {
    paths.push(parent)
  }

  return paths
}

/** Matches a prefix with either separator, and the rest of it literally. */
function prefixPattern(prefix: string): string {
  return prefix
    .split('/')
    .map(escapeRegExp)
    .join(String.raw`[\\/]`)
}

function splitSuffix(path: string): { file: string; suffix: string } {
  const queryAt = path.indexOf('?')

  if (queryAt !== -1) {
    return { file: path.slice(0, queryAt), suffix: path.slice(queryAt) }
  }

  const suffix = FILE_SUFFIX.exec(path)?.[0] ?? ''

  return { file: path.slice(0, path.length - suffix.length), suffix }
}

function isOutside(relativePath: string): boolean {
  return relativePath === '..' || relativePath.startsWith('../') || posix.isAbsolute(relativePath)
}

/** How many `..` segments a relative path starts with. */
function upLevels(relativePath: string): number {
  const segments = relativePath.split('/')
  const first = segments.findIndex((segment) => segment !== '..')

  return first === -1 ? segments.length : first
}

/**
 * Names files relative to a project root, so recorded data does not name the
 * machine that wrote it. The root has two spellings, as given and its real
 * path, because Vite's module ids use the real one.
 */
export class ProjectPaths {
  private readonly spellings: string[]
  private readonly pattern: RegExp | null

  constructor(root: string) {
    const resolved = resolve(root)
    const spellings = [resolved]

    if (existsSync(resolved)) {
      spellings.push(realpathSync(resolved))
    }

    this.spellings = [...new Set(spellings.map(toPosix))]
    this.pattern = this.machinePattern()
  }

  /**
   * An absolute path, with its `?query` or `:line:column`, as a path from the
   * root, or from the last `node_modules/` for a package outside it.
   * `undefined` for the root itself and any other file outside it.
   */
  of(file: string): string | undefined {
    const { file: path, suffix } = splitSuffix(toPosix(file))

    for (const spelling of this.spellings) {
      const relativePath = posix.relative(spelling, path)

      if (relativePath !== '' && !isOutside(relativePath)) {
        return `${relativePath}${suffix}`
      }
    }

    const packageAt = path.lastIndexOf('/node_modules/')

    return packageAt === -1 ? undefined : `${path.slice(packageAt + 1)}${suffix}`
  }

  /**
   * Free text, such as a stack, a warning or bundled code, with every path
   * under the root or one of its ancestors written relative to the root. An
   * ancestor right under `/`, such as `/home`, is the same on every machine,
   * so paths under it stay, and all of them do when the root sits there.
   */
  inText(text: string): string {
    if (this.pattern === null) {
      return text
    }

    return text.replace(this.pattern, (_match: string, path: string) => {
      return this.of(path) ?? this.fromRoot(path)
    })
  }

  /**
   * An absolute path as a path from the spelling of the root it is closest
   * to, with `/`: `src/a.css`, `../../shared/gone.woff2`, or `.` for the root.
   */
  fromRoot(file: string): string {
    const { file: path, suffix } = splitSuffix(toPosix(file))
    const candidates = this.spellings.map((spelling) => posix.relative(spelling, path) || '.')
    const closest = candidates.reduce((best, candidate) => {
      return upLevels(candidate) < upLevels(best) ? candidate : best
    })

    return `${closest}${suffix}`
  }

  /**
   * The spellings of the root and their ancestors, longest first, each
   * followed by a path or by the end of one, after an optional URL lead.
   */
  private machinePattern(): RegExp | null {
    const prefixes = new Set(
      this.spellings
        .flatMap(selfAndAncestors)
        .filter((prefix) => depthOf(prefix) >= MIN_PREFIX_DEPTH),
    )

    if (prefixes.size === 0) {
      return null
    }

    const alternatives = [...prefixes]
      .sort((left, right) => right.length - left.length)
      .map(prefixPattern)
      .join('|')

    const tail = String.raw`(?:[\\/][^${PATH_END}]*|(?=$|[${PATH_END}:]))`

    return new RegExp(`${PATH_START}${URL_LEAD}((?:${alternatives})${tail})`, 'g')
  }
}
