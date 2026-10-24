import type { Manifest, ManifestModule } from '@describe-me/core/types'
import type { CollapsedSuites } from './collapsed-suites.js'
import { groupAsFile } from './group-as-file.js'
import { groupKey } from './group-key.js'
import { sidebarTree, type GroupNode } from './sidebar-tree.js'

function collect(node: GroupNode, collapsed: CollapsedSuites | null, into: ManifestModule[]): void {
  for (const group of node.groups) {
    const asFile = groupAsFile(group)

    // A group shown as its file has no row, so a state stored for it means nothing.
    if (asFile) {
      into.push(asFile)
    } else if (!collapsed?.has(groupKey(group.path))) {
      collect(group, collapsed, into)
    }
  }

  into.push(...node.modules)
}

/**
 * The modules in sidebar order: depth first, a group's subgroups before its
 * files, and the files without a group last. With `collapsed`, the files under
 * a closed group are left out.
 */
export function sidebarModules(
  manifest: Manifest,
  collapsed: CollapsedSuites | null,
): ManifestModule[] {
  const modules: ManifestModule[] = []
  collect(sidebarTree(manifest), collapsed, modules)

  return modules
}
