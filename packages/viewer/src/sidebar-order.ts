import type { ManifestTest } from '@describe-me/core/types'
import { state } from './state.js'
import { buildTree, type SuiteNode } from './tree.js'

function collect(node: SuiteNode, into: ManifestTest[]): void {
  for (const child of node.children) {
    if ('suites' in child) {
      collect(child, into)
    } else {
      into.push(child)
    }
  }
}

/**
 * Every test in the sidebar's order, as if nothing were collapsed and no
 * search were on. `visibleTests()` walks the same tree, so the two orders agree.
 */
export function sidebarOrder(): ManifestTest[] {
  const manifest = state.manifest
  if (!manifest) {
    return []
  }

  const tests: ManifestTest[] = []
  for (const mod of manifest.modules) {
    collect(buildTree(mod), tests)
  }

  return tests
}
