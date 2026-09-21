import type { ComponentDoc } from '@describe-me/core/types'
import type { ComponentEntry } from './collect-component-docs.js'

let warned = false

function warnAboutMissingTypeScript(): void {
  if (warned) {
    return
  }

  warned = true
  console.warn('describe-me: typescript is not installed, component props will not be documented')
}

/**
 * Document the rendered components, unless TypeScript is missing. Props are read
 * with TypeScript's own compiler, which is an optional peer dependency, so the
 * collector is imported lazily: a JavaScript-only project gets a warning and no
 * props tables instead of a crashing reporter.
 */
export async function collectComponentDocsSafely(
  root: string,
  entries: Iterable<ComponentEntry>,
): Promise<Record<string, ComponentDoc>> {
  try {
    await import('typescript')
  } catch {
    warnAboutMissingTypeScript()
    return {}
  }

  const { collectComponentDocs } = await import('./collect-component-docs.js')

  return collectComponentDocs(root, entries)
}
