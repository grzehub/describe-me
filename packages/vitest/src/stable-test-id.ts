import { createHash } from 'node:crypto'

/**
 * A test id that survives edits to other tests in its file. `moduleId` is
 * root-relative with `/` separators, so Windows and posix agree.
 */
export function stableTestId(
  moduleId: string,
  path: readonly string[],
  name: string,
  occurrence: number,
): string {
  let input = [moduleId, ...path, name].join('\0')
  if (occurrence > 1) {
    input += `\0${occurrence}`
  }

  return createHash('sha1').update(input).digest('hex').slice(0, 12)
}
