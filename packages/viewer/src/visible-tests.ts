import type { ManifestTest } from '@describe-me/core/types'
import { CollapsedSuites } from './collapsed-suites.js'
import { filterActive } from './filter-active.js'
import { matchesFilter } from './matches-filter.js'
import { soleSuite } from './sole-suite.js'
import { state } from './state.js'
import { suiteKey } from './suite-key.js'
import { buildTree, type SuiteNode } from './tree.js'

function collect(
  node: SuiteNode,
  moduleId: string,
  path: string[],
  collapsed: CollapsedSuites | null,
  into: ManifestTest[],
): void {
  for (const child of node.children) {
    if (!('suites' in child)) {
      if (matchesFilter(child, moduleId)) {
        into.push(child)
      }

      continue
    }

    const childPath = [...path, child.name]
    if (!collapsed?.has(suiteKey(moduleId, childPath))) {
      collect(child, moduleId, childPath, collapsed, into)
    }
  }
}

/**
 * The tests the sidebar shows, in its order, after the search, the tag filter
 * and the collapsed suites. It walks the same tree by the same rules as the sidebar.
 */
export function visibleTests(): ManifestTest[] {
  const manifest = state.manifest
  if (!manifest) {
    return []
  }

  // A search or a tag shows every match, collapsed or not.
  const collapsed = filterActive() ? null : CollapsedSuites.for(manifest.root)
  const tests: ManifestTest[] = []

  for (const mod of manifest.modules) {
    const root = buildTree(mod)
    const only = soleSuite(root)
    const path = only ? [only.name] : []

    if (!collapsed?.has(suiteKey(mod.id, path))) {
      collect(only ?? root, mod.id, path, collapsed, tests)
    }
  }

  return tests
}
