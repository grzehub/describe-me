import type { ManifestModule, ManifestTest } from '@describe-me/core/types'
import { el } from './el.js'
import { select, selectSuite, state } from './state.js'
import { suiteKey } from './suite-key.js'
import { buildTree, type SuiteNode } from './tree.js'

/**
 * The one describe every test of a module sits under, if there is one. Its
 * overview lists exactly the tests the module's overview would, so the two
 * rows collapse into a single header instead of leading to near-identical
 * pages.
 */
function soleSuite(root: SuiteNode): SuiteNode | null {
  if (root.tests.length > 0 || root.suites.size !== 1) {
    return null
  }

  return [...root.suites.values()][0] ?? null
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
    el('span', { class: 'n' }, String(test.frames.length)),
  )
}

/** The rows under one suite: its own tests, then the suites nested in it. */
function renderRows(node: SuiteNode, moduleId: string, path: string[]): DocumentFragment {
  const rows = document.createDocumentFragment()
  for (const test of node.tests) {
    rows.append(testButton(test))
  }

  for (const child of node.suites.values()) {
    rows.append(renderSuite(child, moduleId, [...path, child.name]))
  }

  return rows
}

function renderSuite(node: SuiteNode, moduleId: string, path: string[]): HTMLElement {
  return el(
    'div',
    { class: 'suite' },
    suiteButton(node.name, suiteKey(moduleId, path)),
    renderRows(node, moduleId, path),
  )
}

function renderModule(mod: ManifestModule): HTMLElement {
  const root = buildTree(mod)
  const only = soleSuite(root)
  const path = only ? [only.name] : []

  return el(
    'div',
    { class: 'module' },
    moduleButton(only?.name ?? null, mod.id, suiteKey(mod.id, path)),
    el('div', { class: 'suite root' }, renderRows(only ?? root, mod.id, path)),
  )
}

/** One block per test module, each holding its suite tree. */
export function renderSidebar(): HTMLElement {
  const aside = el('aside', { class: 'sidebar' })
  for (const mod of state.manifest?.modules ?? []) {
    aside.append(renderModule(mod))
  }

  return aside
}
