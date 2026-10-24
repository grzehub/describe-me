import { sep } from 'node:path'
import { inspect } from 'node:util'
import type { ManifestModule } from '@describe-me/core/types'
import type { SidebarGlob, SidebarGroupRule, SidebarOption } from './validate-sidebar.js'

/** What the reporter writes for `sidebar.groups`. */
export interface SidebarGroups {
  /** The modules in their input order, each rebuilt with its group when it has one. */
  modules: ManifestModule[]
  /** The groups that hold a file, directly or below, depth first in sidebar order. */
  groups: string[][]
  /** One sentence per key that got no file, without the `describe-me: ` prefix. */
  warnings: string[]
}

interface GroupNode {
  name: string
  children: GroupNode[]
  files: number
}

/** The rule that took a file, by its index in key order, and the group it gave. */
interface Assignment {
  rule: number
  group: string[]
}

function toPosix(moduleId: string): string {
  return moduleId.split(sep).join('/')
}

/** The folder name a `*` glob gives the file, or `null` when it gives none. */
function capturedName(glob: SidebarGlob, file: string): string | null {
  const { capture } = glob

  if (capture === undefined || !glob.matches(file)) {
    return null
  }

  const segments = file.split('/')

  // The name is a folder, so never the file name.
  for (let index = 0; index < segments.length - 1; index++) {
    const beforeMatches =
      capture.before === null
        ? index === 0
        : index > 0 && capture.before(segments.slice(0, index).join('/'))

    if (beforeMatches && capture.after(segments.slice(index + 1).join('/'))) {
      return segments[index]
    }
  }

  return null
}

/** The group a rule gives the file, or `null` when none of its globs takes it. */
function groupOf(rule: SidebarGroupRule, file: string): string[] | null {
  const { placeholder } = rule

  if (placeholder === null) {
    return rule.globs.some((glob) => glob.matches(file)) ? [...rule.segments] : null
  }

  for (const glob of rule.globs) {
    const name = capturedName(glob, file)

    if (name !== null) {
      return rule.segments.map((segment, i) => (i === placeholder ? name : segment))
    }
  }

  return null
}

function assignmentOf(rules: SidebarGroupRule[], file: string): Assignment | null {
  for (const [rule, candidate] of rules.entries()) {
    const group = groupOf(candidate, file)

    if (group !== null) {
      return { rule, group }
    }
  }

  return null
}

/** The node at `path`, created at the end of its siblings when it is new. */
function insert(root: GroupNode, path: string[]): GroupNode {
  let node = root

  for (const name of path) {
    let child = node.children.find((candidate) => candidate.name === name)

    if (child === undefined) {
      child = { name, children: [], files: 0 }
      node.children.push(child)
    }

    node = child
  }

  return node
}

/**
 * The groups in key order, so a parent sits where the config first names it.
 * A `*` key adds the groups it produced, by captured name.
 */
function groupTree(rules: SidebarGroupRule[], assignments: (Assignment | null)[]): GroupNode {
  const root: GroupNode = { name: '', children: [], files: 0 }

  for (const [index, rule] of rules.entries()) {
    const { placeholder } = rule

    if (placeholder === null) {
      insert(root, rule.segments)
      continue
    }

    insert(root, rule.segments.slice(0, placeholder))

    const produced = new Map<string, string[]>()

    for (const assignment of assignments) {
      if (assignment?.rule === index) {
        produced.set(assignment.group[placeholder], assignment.group)
      }
    }

    const names = [...produced.keys()].sort((left, right) => left.localeCompare(right))

    for (const name of names) {
      insert(root, produced.get(name) as string[])
    }
  }

  for (const assignment of assignments) {
    if (assignment !== null) {
      insert(root, assignment.group).files++
    }
  }

  return root
}

/** The paths below `node` that hold a file, depth first, each group before its subgroups. */
function listedGroups(node: GroupNode, path: string[]): string[][] {
  const listed: string[][] = []

  for (const child of node.children) {
    const childPath = [...path, child.name]
    const below = listedGroups(child, childPath)

    if (child.files > 0 || below.length > 0) {
      listed.push(childPath, ...below)
    }
  }

  return listed
}

function emptyKeyWarning(rule: SidebarGroupRule, matched: number, takers: string[]): string {
  const subject = `sidebar.groups[${inspect(rule.key)}]`

  if (matched === 0) {
    return `${subject} matches no recorded test file, so the group stays empty.`
  }

  const files = matched === 1 ? 'the file' : `the ${matched} files`
  const keys = takers.map((key) => inspect(key)).join(', ')

  if (takers.length === 1) {
    return `${subject} gets no test file, because an earlier key takes ${files} it matches: ${keys}. Move it above that key or narrow that key's globs.`
  }

  return `${subject} gets no test file, because earlier keys take ${files} it matches: ${keys}. Move it above them or narrow their globs.`
}

function warningsOf(
  rules: SidebarGroupRule[],
  files: string[],
  assignments: (Assignment | null)[],
): string[] {
  const warnings: string[] = []

  for (const [index, rule] of rules.entries()) {
    if (assignments.some((assignment) => assignment?.rule === index)) {
      continue
    }

    // Every file this key matches went to an earlier key, or it would be this key's.
    const takers = new Set<number>()
    let matched = 0

    for (const [fileIndex, file] of files.entries()) {
      const taker = assignments[fileIndex]

      if (taker !== null && groupOf(rule, file) !== null) {
        takers.add(taker.rule)
        matched++
      }
    }

    const keys = [...takers].sort((left, right) => left - right).map((taker) => rules[taker].key)
    warnings.push(emptyKeyWarning(rule, matched, keys))
  }

  return warnings
}

/**
 * Gives each module the group of the first key that matches its file, lists
 * the groups in sidebar order and warns about keys that got no file. Every
 * module is rebuilt, so a group from the previous manifest never survives.
 */
export function sidebarGroups(modules: ManifestModule[], option: SidebarOption): SidebarGroups {
  const rules = option.groups
  const files = modules.map((mod) => toPosix(mod.id))
  const assignments = files.map((file) => assignmentOf(rules, file))

  const grouped = modules.map((mod, i): ManifestModule => {
    const group = assignments[i]?.group

    if (group === undefined) {
      return { id: mod.id, tests: mod.tests }
    }

    return { id: mod.id, group, tests: mod.tests }
  })

  return {
    modules: grouped,
    groups: listedGroups(groupTree(rules, assignments), []),
    warnings: warningsOf(rules, files, assignments),
  }
}
