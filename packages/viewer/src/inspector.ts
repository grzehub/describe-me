import { el } from './el.js'
import { currentTest, state } from './state.js'
import { valueCell } from './value-cell.js'

/** Right-hand pane: test status, component props, current frame, errors. */
export function renderInspector(): HTMLElement {
  const test = currentTest()
  const aside = el('aside', { class: 'inspector' })
  if (!test) {
    return aside
  }

  const frame = test.frames[state.frame]
  const props =
    (frame?.meta?.props as Record<string, unknown> | undefined) ?? test.component?.props ?? {}

  const status = el('section', {}, el('h3', {}, 'test'))
  status.append(
    el(
      'div',
      { class: 'status' },
      el('span', { class: `dot ${test.state}` }),
      test.state,
      test.duration != null
        ? el('span', { class: 'hint' }, `${Math.round(test.duration)}ms`)
        : null,
    ),
  )

  aside.append(status)

  if (test.component) {
    const table = el('table', { class: 'kv' })
    for (const [key, value] of Object.entries(props)) {
      table.append(el('tr', {}, el('td', {}, key), el('td', {}, valueCell(value))))
    }

    if (!Object.keys(props).length) {
      table.append(el('tr', {}, el('td', {}, el('span', { class: 'hint' }, 'no props'))))
    }

    aside.append(el('section', {}, el('h3', {}, `component · ${test.component.name}`), table))
  }

  if (frame) {
    aside.append(
      el(
        'section',
        {},
        el('h3', {}, `frame ${state.frame + 1} / ${test.frames.length}`),
        el('div', {}, frame.label),
        el('div', { class: 'hint' }, `${frame.kind} · ${frame.at}ms into the test`),
      ),
    )
  }

  if (test.errors?.length) {
    const sec = el('section', {}, el('h3', {}, 'errors'))
    for (const error of test.errors) {
      sec.append(el('pre', { class: 'err' }, error.message))
    }

    aside.append(sec)
  }

  aside.append(
    el(
      'section',
      {},
      el(
        'div',
        { class: 'hint' },
        el('kbd', {}, '←'),
        ' ',
        el('kbd', {}, '→'),
        ' frames · ',
        el('kbd', {}, '↑'),
        ' ',
        el('kbd', {}, '↓'),
        ' tests',
      ),
    ),
  )

  return aside
}
