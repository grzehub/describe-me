import type { SuiteNode } from './tree.js'

/**
 * The one describe every test of a module sits under, if there is one. Its
 * overview lists exactly the tests the module's overview would, so the two
 * rows collapse into a single header instead of leading to near-identical
 * pages.
 */
export function soleSuite(root: SuiteNode): SuiteNode | null {
  if (root.tests.length > 0 || root.suites.size !== 1) {
    return null
  }

  return [...root.suites.values()][0] ?? null
}
