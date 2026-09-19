import { h } from './h.js'
import { select, state } from './state.js'
import { buildTree, type SuiteNode } from './tree.js'

function renderSuite(node: SuiteNode): HTMLElement {
  const wrap = h('div', { class: 'suite' })
  if (node.name) wrap.append(h('div', { class: 'suite-name' }, node.name))
  for (const t of node.tests) {
    wrap.append(
      h(
        'button',
        {
          class: `test${t.id === state.testId ? ' active' : ''}`,
          click: () => select(t.id),
          title: t.fullName,
        },
        h('span', { class: `dot ${t.state}` }),
        h('span', {}, t.name),
        h('span', { class: 'n' }, String(t.frames.length)),
      ),
    )
  }
  for (const child of node.suites.values()) wrap.append(renderSuite(child))
  return wrap
}

/** One block per test module, each holding its suite tree. */
export function renderSidebar(): HTMLElement {
  const aside = h('aside', { class: 'sidebar' })
  for (const mod of state.manifest?.modules ?? []) {
    const tree = buildTree(mod)
    aside.append(
      h('div', { class: 'module' }, h('div', { class: 'module-name' }, mod.id), renderSuite(tree)),
    )
  }
  return aside
}
