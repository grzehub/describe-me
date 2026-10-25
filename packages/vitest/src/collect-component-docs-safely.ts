import type { ComponentDoc } from '@describe-me/core/types'
import type { ComponentEntry } from './collect-component-docs.js'
import { firstLineOf } from './first-line-of.js'

const MISSING_TYPESCRIPT =
  'describe-me: typescript is not installed, component props will not be documented'

/** Shown once per process, however many runs a watch makes. */
const warned = new Set<string>()

function warnOnce(message: string): void {
  if (warned.has(message)) {
    return
  }

  warned.add(message)
  console.warn(message)
}

/** The installed `typescript`, or null when it cannot be imported. */
async function importTypeScript(): Promise<object | null> {
  try {
    const imported = (await import('typescript')) as { default?: object }

    return imported.default ?? imported
  } catch {
    return null
  }
}

/**
 * TypeScript 7 imports fine, but its package exports only its version: the
 * compiler API that the props reader is written against ends with TypeScript 6.
 */
function hasCompilerApi(typescript: object): boolean {
  return typeof (typescript as { createProgram?: unknown }).createProgram === 'function'
}

/** `typescript 7.0.2`, or `typescript` when the package names no version. */
function packageLabel(typescript: object): string {
  const { version } = typescript as { version?: unknown }

  return typeof version === 'string' ? `typescript ${version}` : 'typescript'
}

/**
 * Document the rendered components, unless TypeScript is missing or cannot read
 * them. Props are read with TypeScript's own compiler, which is an optional peer
 * dependency, so the collector is imported lazily: a JavaScript-only project, or
 * one on TypeScript 7, gets a warning and no props tables instead of a crashing
 * reporter. Never rejects, because the props are a diagnostic and must not cost
 * the manifest.
 */
export async function collectComponentDocsSafely(
  root: string,
  entries: Iterable<ComponentEntry>,
): Promise<Record<string, ComponentDoc>> {
  const rendered = Array.from(entries)

  // Importing TypeScript takes a few hundred milliseconds, wasted on a run
  // that recorded no component.
  if (rendered.length === 0) {
    return {}
  }

  const typescript = await importTypeScript()

  if (typescript === null) {
    warnOnce(MISSING_TYPESCRIPT)
    return {}
  }

  if (!hasCompilerApi(typescript)) {
    warnOnce(
      `describe-me: ${packageLabel(typescript)} has no compiler API that describe-me can use, component props will not be documented`,
    )

    return {}
  }

  try {
    const { collectComponentDocs } = await import('./collect-component-docs.js')

    return collectComponentDocs(root, rendered)
  } catch (error) {
    console.warn(`describe-me: component props could not be read: ${firstLineOf(error)}`)
    return {}
  }
}
