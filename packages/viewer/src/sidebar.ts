import { el } from './el.js'
import { select, state } from './state.js'
import { buildTree, type SuiteNode } from './tree.js'

function renderSuite(node: SuiteNode): HTMLElement {
  const wrap = el('div', { class: 'suite' })
  if (node.name) {
    wrap.append(el('div', { class: 'suite-name' }, node.name))
  }

  for (const test of node.tests) {
    wrap.append(
      el(
        'button',
        {
          class: `test${test.id === state.testId ? ' active' : ''}`,
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
    wrap.append(renderSuite(child))
  }

  return wrap
}

/** One block per test module, each holding its suite tree. */
export function renderSidebar(): HTMLElement {
  const aside = el('aside', { class: 'sidebar' })
  for (const mod of state.manifest?.modules ?? []) {
    const tree = buildTree(mod)
    aside.append(
      el(
        'div',
        { class: 'module' },
        el('div', { class: 'module-name' }, mod.id),
        renderSuite(tree),
      ),
    )
  }

  return aside
}
