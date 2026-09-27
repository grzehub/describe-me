import type { CompiledGlob, RuntimeOptions } from './runtime-options.js'

function toRegExps(globs: CompiledGlob[]): RegExp[] {
  return globs.map((glob) => new RegExp(glob.source, glob.flags))
}

/**
 * Takes a path relative to the root, with posix separators. Build it once and
 * reuse the returned function, which memoizes per file name. The test runtime
 * imports this file, so no Node imports.
 */
export function fileFilter(
  options: Pick<RuntimeOptions, 'include' | 'exclude'>,
): (fileName: string) => boolean {
  const include = toRegExps(options.include)
  const exclude = toRegExps(options.exclude)
  const answers = new Map<string, boolean>()

  return (fileName) => {
    const known = answers.get(fileName)
    if (known !== undefined) {
      return known
    }

    const included = include.length === 0 || include.some((glob) => glob.test(fileName))
    const answer = included && !exclude.some((glob) => glob.test(fileName))
    answers.set(fileName, answer)

    return answer
  }
}
