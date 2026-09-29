import type { ManifestModule, ManifestTest } from '@describe-me/core/types'

export interface SuiteNode {
  name: string
  suites: Map<string, SuiteNode>
  tests: ManifestTest[]
  /** Tests and nested suites in the order they first appear, which is source order. */
  children: (ManifestTest | SuiteNode)[]
}

function suiteNode(name: string): SuiteNode {
  return { name, suites: new Map(), tests: [], children: [] }
}

/** Nest a module's flat test list back into its `describe` hierarchy. */
export function buildTree(mod: ManifestModule): SuiteNode {
  const root = suiteNode('')
  for (const test of mod.tests) {
    let node = root
    for (const part of test.path) {
      let next = node.suites.get(part)
      if (!next) {
        next = suiteNode(part)
        node.suites.set(part, next)
        node.children.push(next)
      }

      node = next
    }

    node.tests.push(test)
    node.children.push(test)
  }

  return root
}
