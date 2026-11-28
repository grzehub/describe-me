import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Whether `path`, relative to `dir`, names `dir` itself or anything outside it. */
export function isOutside(dir: string, path: string): boolean {
  const rest = relative(resolve(dir), resolve(dir, path))

  return rest === '' || rest === '..' || rest.startsWith(`..${sep}`) || isAbsolute(rest)
}
