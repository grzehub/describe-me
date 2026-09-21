import { el } from './el.js'
import { select, selectSuite, state } from './state.js'
import { suiteKey } from './suite-key.js'
import { buildTree, type SuiteNode } from './tree.js'

function scopeButton(label: string, key: string, kind: 'module' | 'suite'): HTMLElement {
  return el(
    'button',
    {
      class: `${kind}-button${key === state.suiteKey ? ' active' : ''}`,
      click: () => selectSuite(key),
      title: `overview of ${label}`,
    },
    label,
  )
}

function renderSuite(node: SuiteNode, moduleId: string, path: string[]): HTMLElement {
  const wrap = el('div', { class: 'suite' })
  if (node.name) {
    wrap.append(scopeButton(node.name, suiteKey(moduleId, path), 'suite'))
  }

  for (const test of node.tests) {
    wrap.append(
      el(
        'button',
        {
          class: `test${!state.suiteKey && test.id === state.testId ? ' active' : ''}`,
          click: () => select(test.id),
          title: test.fullName,
        },
        el('span', { class: `dot ${test.state}` }),
        el('span', {}, test.name),
        el('span', { class: 'n' }, String(test.frames.length)),
      ),
    )
  }

  for (const child of node.suites.values()) {
    wrap.append(renderSuite(child, moduleId, [...path, child.name]))
  }

  return wrap
}

/** One block per test module, each holding its suite tree. */
export function renderSidebar(): HTMLElement {
  const aside = el('aside', { class: 'sidebar' })
  for (const mod of state.manifest?.modules ?? []) {
    aside.append(
      el(
        'div',
        { class: 'module' },
        scopeButton(mod.id, suiteKey(mod.id, []), 'module'),
        renderSuite(buildTree(mod), mod.id, []),
      ),
    )
  }

  return aside
}
