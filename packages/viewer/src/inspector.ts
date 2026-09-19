import { h } from './h.js'
import { currentTest, state } from './state.js'
import { valueCell } from './value-cell.js'

/** Right-hand pane: test status, component props, current frame, errors. */
export function renderInspector(): HTMLElement {
  const test = currentTest()
  const aside = h('aside', { class: 'inspector' })
  if (!test) return aside
  const frame = test.frames[state.frame]
  const props =
    (frame?.meta?.props as Record<string, unknown> | undefined) ?? test.component?.props ?? {}

  const status = h('section', {}, h('h3', {}, 'test'))
  status.append(
    h(
      'div',
      { class: 'status' },
      h('span', { class: `dot ${test.state}` }),
      test.state,
      test.duration != null ? h('span', { class: 'hint' }, `${Math.round(test.duration)}ms`) : null,
    ),
  )
  aside.append(status)

  if (test.component) {
    const table = h('table', { class: 'kv' })
    for (const [k, v] of Object.entries(props))
      table.append(h('tr', {}, h('td', {}, k), h('td', {}, valueCell(v))))
    if (!Object.keys(props).length)
      table.append(h('tr', {}, h('td', {}, h('span', { class: 'hint' }, 'no props'))))
    aside.append(h('section', {}, h('h3', {}, `component · ${test.component.name}`), table))
  }

  if (frame) {
    aside.append(
      h(
        'section',
        {},
        h('h3', {}, `frame ${state.frame + 1} / ${test.frames.length}`),
        h('div', {}, frame.label),
        h('div', { class: 'hint' }, `${frame.kind} · ${frame.at}ms into the test`),
      ),
    )
  }

  if (test.errors?.length) {
    const sec = h('section', {}, h('h3', {}, 'errors'))
    for (const e of test.errors) sec.append(h('pre', { class: 'err' }, e.message))
    aside.append(sec)
  }

  aside.append(
    h(
      'section',
      {},
      h(
        'div',
        { class: 'hint' },
        h('kbd', {}, '←'),
        ' ',
        h('kbd', {}, '→'),
        ' frames · ',
        h('kbd', {}, '↑'),
        ' ',
        h('kbd', {}, '↓'),
        ' tests',
      ),
    ),
  )
  return aside
}
