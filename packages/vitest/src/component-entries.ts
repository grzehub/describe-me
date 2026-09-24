import { resolve } from 'node:path'
import type { ManifestModule } from '@describe-me/core/types'
import type { ComponentEntry } from './collect-component-docs.js'

/** Every component the recorded tests rendered, paired with the module that rendered it. */
export function componentEntries(modules: ManifestModule[], root: string): ComponentEntry[] {
  const entries: ComponentEntry[] = []

  for (const mod of modules) {
    for (const test of mod.tests) {
      if (test.component) {
        entries.push({
          testFile: resolve(root, mod.id),
          componentName: test.component.name,
          componentFile: test.component.file,
        })
      }
    }
  }

  return entries
}
