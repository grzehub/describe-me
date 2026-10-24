import type { ManifestModule } from '@describe-me/core/types'
import type { GroupNode } from './sidebar-tree.js'
import { soleSuite } from './sole-suite.js'
import { buildTree } from './tree.js'

/**
 * The one file a group shows as instead of a row of its own: the group has no
 * subgroups and one file, whose header names the group in any case. It looks
 * at the whole module, so the sidebar keeps its shape while a filter narrows it.
 */
export function groupAsFile(node: GroupNode): ManifestModule | null {
  const [only] = node.modules
  if (!only || node.modules.length !== 1 || node.groups.length > 0) {
    return null
  }

  const header = soleSuite(buildTree(only))?.name

  return header?.toLowerCase() === node.name.toLowerCase() ? only : null
}
