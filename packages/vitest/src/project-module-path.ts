import { isAbsolute, relative, sep } from 'node:path'

/** Modules that can export a component: JavaScript and TypeScript, with or without JSX. */
const SCRIPT_MODULE = /\.[cm]?[jt]sx?$/

const TEST_MODULE = /\.(test|spec)\.[cm]?[jt]sx?$/

/**
 * The path of a Vite module id relative to the project root, with posix
 * separators, or null when the module is not the project's own source: a
 * virtual module (`\0…`), a request with a query (`?raw`, `?worker`), anything
 * outside the root or in node_modules, a non-script file, or a test file.
 */
export function projectModulePath(id: string, root: string): string | null {
  if (root === '' || id.startsWith('\0') || id.includes('?')) {
    return null
  }

  if (id.includes('/node_modules/') || !SCRIPT_MODULE.test(id) || TEST_MODULE.test(id)) {
    return null
  }

  const path = relative(root, id)

  if (path === '' || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    return null
  }

  return path.split(sep).join('/')
}
