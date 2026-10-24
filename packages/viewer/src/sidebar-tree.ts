import type { Manifest, ManifestModule } from '@describe-me/core/types'

/** A sidebar group, with its subgroups and its files in sidebar order. The root has no name. */
export interface GroupNode {
  name: string
  path: string[]
  groups: GroupNode[]
  modules: ManifestModule[]
}

function groupNode(path: string[]): GroupNode {
  return { name: path.at(-1) ?? '', path, groups: [], modules: [] }
}

/** The node of `path`, created under its parent, and the parent on the way, when it is missing. */
function nodeAt(nodes: Map<string, GroupNode>, path: string[]): GroupNode {
  const key = JSON.stringify(path)
  const known = nodes.get(key)
  if (known) {
    return known
  }

  const node = groupNode(path)
  nodeAt(nodes, path.slice(0, -1)).groups.push(node)
  nodes.set(key, node)

  return node
}

/** Drop the subgroups that hold no module, directly or below, and say whether `node` holds one. */
function prune(node: GroupNode): boolean {
  node.groups = node.groups.filter(prune)

  return node.groups.length > 0 || node.modules.length > 0
}

/**
 * The manifest's modules in their sidebar groups, which keep the order of
 * `sidebar.groups`. Without that list the root holds every module. A module
 * whose group the list leaves out sits in the root with the ungrouped ones,
 * and a group left without a module is dropped.
 */
export function sidebarTree(manifest: Manifest): GroupNode {
  const root = groupNode([])
  const listed = manifest.sidebar?.groups ?? []

  if (listed.length === 0) {
    root.modules = [...manifest.modules]
    return root
  }

  const nodes = new Map<string, GroupNode>([[JSON.stringify([]), root]])
  const homes = new Map<string, GroupNode>(
    listed.map((path) => [JSON.stringify(path), nodeAt(nodes, path)]),
  )

  for (const mod of manifest.modules) {
    const home = homes.get(JSON.stringify(mod.group ?? [])) ?? root
    home.modules.push(mod)
  }

  prune(root)

  return root
}
