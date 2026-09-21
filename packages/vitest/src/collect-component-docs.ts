import { relative, sep } from 'node:path'
import ts from 'typescript'
import type { ComponentDoc } from '@describe-me/core/types'
import { extractProps } from './extract-props.js'
import { loadCompilerOptions } from './load-compiler-options.js'
import { resolveComponentFile, type ResolvedComponent } from './resolve-component-file.js'

/** A component name as the adapter reported it, and the test module that rendered it. */
export interface ComponentEntry {
  testFile: string
  componentName: string
}

/**
 * Document every component the tests rendered: find its source file through the
 * test's imports, then read its props from TypeScript. One program covers all of
 * them; a component that cannot be found or read is left out of the result.
 */
export function collectComponentDocs(
  root: string,
  entries: Iterable<ComponentEntry>,
): Record<string, ComponentDoc> {
  const options = loadCompilerOptions(root)
  const resolved = resolveAll(entries, options)

  if (resolved.size === 0) {
    return {}
  }

  const files = Array.from(new Set(Array.from(resolved.values(), (found) => found.file)))
  const program = ts.createProgram(files, options)
  const docs: Record<string, ComponentDoc> = {}

  for (const name of Array.from(resolved.keys()).sort()) {
    const found = resolved.get(name) as ResolvedComponent
    const props = extractProps(program, found.file, found.exportName)

    if (!props) {
      console.warn(`[describe-me] could not read props of ${name} from ${found.file}`)
      continue
    }

    docs[name] = { name, file: toPosix(relative(root, found.file)), props }
  }

  return docs
}

/** One source file per component name; the same component is looked up once. */
function resolveAll(
  entries: Iterable<ComponentEntry>,
  options: ts.CompilerOptions,
): Map<string, ResolvedComponent> {
  const resolved = new Map<string, ResolvedComponent>()

  for (const entry of entries) {
    if (resolved.has(entry.componentName)) {
      continue
    }

    const found = resolveComponentFile(entry.testFile, entry.componentName, options)

    if (found) {
      resolved.set(entry.componentName, found)
    }
  }

  return resolved
}

/** The manifest is read in a browser, where paths are posix whatever wrote them. */
function toPosix(path: string): string {
  return path.split(sep).join('/')
}
