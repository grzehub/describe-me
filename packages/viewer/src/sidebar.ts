import type { ManifestModule, ManifestTest } from '@describe-me/core/types'
import { CollapsedSuites } from './collapsed-suites.js'
import { el } from './el.js'
import { filterActive } from './filter-active.js'
import { matchesFilter } from './matches-filter.js'
import { shownTags } from './shown-tags.js'
import { soleSuite } from './sole-suite.js'
import { select, selectSuite, state } from './state.js'
import { suiteKey } from './suite-key.js'
import { buildTree, type SuiteNode } from './tree.js'

/** What every row of one repaint needs to know. `collapsed` is `null` while a filter is on. */
interface Walk {
  moduleId: string
  collapsed: CollapsedSuites | null
  onToggle: () => void
}

/** Opens or closes a module or suite. It never opens the overview. */
function twisty(
  label: string,
  key: string,
  collapsed: CollapsedSuites,
  onToggle: () => void,
): HTMLElement {
  const open = !collapsed.has(key)

  return el('button', {
    class: 'twisty',
    'aria-expanded': String(open),
    'aria-label': `${open ? 'Collapse' : 'Expand'} ${label}`,
    click: () => {
      collapsed.toggle(key)
      onToggle()
    },
  })
}

/** A module or suite button, with its twisty in front when collapsing is on. */
function headerRow(button: HTMLElement, label: string, key: string, walk: Walk): HTMLElement {
  if (!walk.collapsed) {
    return button
  }

  return el('div', { class: 'row' }, twisty(label, key, walk.collapsed, walk.onToggle), button)
}

/** The header of a module block: the describe it holds, over the file it came from. */
function moduleButton(name: string | null, file: string, key: string): HTMLElement {
  return el(
    'button',
    {
      class: `module-button${key === state.suiteKey ? ' active' : ''}`,
      click: () => selectSuite(key),
      title: `overview of ${name ? `${name} — ${file}` : file}`,
    },
    name ? el('span', { class: 'module-name' }, name) : null,
    el('span', { class: 'module-path' }, file),
  )
}

function suiteButton(label: string, key: string): HTMLElement {
  return el(
    'button',
    {
      class: `suite-button${key === state.suiteKey ? ' active' : ''}`,
      click: () => selectSuite(key),
      title: `overview of ${label}`,
    },
    label,
  )
}

/** The test's tags, quiet next to its name. A row is a button, so they are not buttons too. */
function tagChips(test: ManifestTest): HTMLElement | null {
  const tags = shownTags(test)

  if (tags.length === 0) {
    return null
  }

  return el('span', { class: 'test-tags' }, ...tags.map((tag) => el('span', { class: 'tag' }, tag)))
}

function testButton(test: ManifestTest): HTMLElement {
  return el(
    'button',
    {
      class: `test${!state.suiteKey && test.id === state.testId ? ' active' : ''}`,
      click: () => select(test.id),
      title: test.fullName,
    },
    el('span', { class: `dot ${test.state}` }),
    el('span', { class: 'test-name' }, test.name),
    tagChips(test),
    el('span', { class: 'n' }, String(test.frames.length)),
  )
}

/** The rows under one suite, in source order. A filter leaves out tests that do not match. */
function renderRows(node: SuiteNode, path: string[], walk: Walk): DocumentFragment {
  const rows = document.createDocumentFragment()
  for (const child of node.children) {
    if (!('suites' in child)) {
      if (matchesFilter(child, walk.moduleId)) {
        rows.append(testButton(child))
      }

      continue
    }

    const suite = renderSuite(child, [...path, child.name], walk)
    if (suite) {
      rows.append(suite)
    }
  }

  return rows
}

/** A suite and its rows, or `null` when a filter leaves nothing in it. */
function renderSuite(node: SuiteNode, path: string[], walk: Walk): HTMLElement | null {
  const key = suiteKey(walk.moduleId, path)
  const header = headerRow(suiteButton(node.name, key), node.name, key, walk)

  if (walk.collapsed?.has(key)) {
    return el('div', { class: 'suite' }, header)
  }

  const rows = renderRows(node, path, walk)
  if (!walk.collapsed && rows.childNodes.length === 0) {
    return null
  }

  return el('div', { class: 'suite' }, header, rows)
}

/** A module block, or `null` when a filter leaves nothing in it. */
function renderModule(
  mod: ManifestModule,
  collapsed: CollapsedSuites | null,
  onToggle: () => void,
): HTMLElement | null {
  const walk: Walk = { moduleId: mod.id, collapsed, onToggle }
  // On the whole tree, so a module header keeps its shape while a filter narrows it.
  const root = buildTree(mod)
  const only = soleSuite(root)
  const path = only ? [only.name] : []
  const key = suiteKey(mod.id, path)
  const header = headerRow(
    moduleButton(only?.name ?? null, mod.id, key),
    only?.name ?? mod.id,
    key,
    walk,
  )

  if (collapsed?.has(key)) {
    return el('div', { class: 'module' }, header)
  }

  const rows = renderRows(only ?? root, path, walk)
  if (!collapsed && rows.childNodes.length === 0) {
    return null
  }

  return el('div', { class: 'module' }, header, el('div', { class: 'suite root' }, rows))
}

/** What the empty sidebar says, naming the search, the tag or both. */
function noMatches(): string {
  const query = state.query.trim()

  if (state.tag === null) {
    return `no tests match "${query}"`
  }

  return query
    ? `no tests tagged "${state.tag}" match "${query}"`
    : `no tests tagged "${state.tag}"`
}

/**
 * One block per test module, each holding its suite tree, or a line saying the
 * filter found nothing. `onToggle` repaints after a module or suite opens or closes.
 */
export function renderSidebar(onToggle: () => void): HTMLElement[] {
  const manifest = state.manifest
  if (!manifest) {
    return []
  }

  const filtered = filterActive()
  const collapsed = filtered ? null : CollapsedSuites.for(manifest.root)
  const blocks = manifest.modules
    .map((mod) => renderModule(mod, collapsed, onToggle))
    .filter((block): block is HTMLElement => block !== null)

  if (blocks.length === 0 && filtered) {
    return [el('div', { class: 'empty' }, noMatches())]
  }

  return blocks
}
