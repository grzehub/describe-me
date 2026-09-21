import type { ManifestTest } from '@describe-me/core/types'
import { parseSuiteKey } from './suite-key.js'
import { state } from './state.js'

/**
 * The tests a suite key selects: every test of that module whose suite path
 * starts with the key's path, so a module-level key takes the whole module.
 */
export function testsInScope(key: string): ManifestTest[] {
  const { moduleId, path } = parseSuiteKey(key)
  const mod = state.manifest?.modules.find((candidate) => candidate.id === moduleId)
  if (!mod) {
    return []
  }

  return mod.tests.filter((test) => path.every((part, index) => test.path[index] === part))
}
