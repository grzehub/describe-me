import { relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import type { ComponentDoc } from '@describe-me/core/types'
import { extractProps } from './extract-props.js'
import { loadCompilerOptions } from './load-compiler-options.js'
import { resolveComponentFile, type ResolvedComponent } from './resolve-component-file.js'

/** A component name as the adapter reported it, and the test module that rendered it. */
export interface ComponentEntry {
  testFile: string
  componentName: string
  /**
   * The module that defines the component, relative to the root, when the
   * plugin registered its exports. Otherwise the test's imports are searched.
   */
  componentFile?: string
}

/**
 * Document every component the tests rendered: find its source file, then read
 * its props from TypeScript. One program covers all of them; a component that
 * cannot be found or read is left out of the result.
 */
export function collectComponentDocs(
  root: string,
  entries: Iterable<ComponentEntry>,
): Record<string, ComponentDoc> {
  const options = loadCompilerOptions(root)
  const resolved = resolveAll(root, Array.from(entries), options)

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

/**
 * One source file per component name. Files the plugin registered come first,
 * because the test's imports are only a guess; among them the first one seen
 * for a name wins. The remaining names are looked up through the imports.
 */
function resolveAll(
  root: string,
  entries: ComponentEntry[],
  options: ts.CompilerOptions,
): Map<string, ResolvedComponent> {
  const resolved = registeredComponents(root, entries)

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

/**
 * The components whose file the adapter reported. Docs are keyed by name, so
 * two components exported under the same name from different files cannot
 * both be documented: the first stays, and the clash is reported once.
 */
function registeredComponents(
  root: string,
  entries: ComponentEntry[],
): Map<string, ResolvedComponent> {
  const resolved = new Map<string, ResolvedComponent>()
  const clashes = new Set<string>()

  for (const { componentName, componentFile } of entries) {
    if (componentFile === undefined) {
      continue
    }

    const file = resolve(root, componentFile)
    const known = resolved.get(componentName)

    if (!known) {
      resolved.set(componentName, { file, exportName: componentName })
      continue
    }

    if (known.file !== file && !clashes.has(componentName)) {
      clashes.add(componentName)

      console.warn(
        `[describe-me] two components are named ${componentName}: ${toPosix(relative(root, known.file))} and ${componentFile}. Only the first is documented.`,
      )
    }
  }

  return resolved
}

/** The manifest is read in a browser, where paths are posix whatever wrote them. */
function toPosix(path: string): string {
  return path.split(sep).join('/')
}
