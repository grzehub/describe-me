import type { ManifestModule, ManifestTest } from '@describe-me/core/types'

export interface SuiteNode {
  name: string
  suites: Map<string, SuiteNode>
  tests: ManifestTest[]
}

/** Nest a module's flat test list back into its `describe` hierarchy. */
export function buildTree(mod: ManifestModule): SuiteNode {
  const root: SuiteNode = { name: '', suites: new Map(), tests: [] }
  for (const test of mod.tests) {
    let node = root
    for (const part of test.path) {
      let next = node.suites.get(part)
      if (!next) {
        node.suites.set(part, (next = { name: part, suites: new Map(), tests: [] }))
      }

      node = next
    }

    node.tests.push(test)
  }

  return root
}
