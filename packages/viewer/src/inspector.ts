import { el } from './el.js'
import { liveSection } from './live-section.js'
import { liveShown } from './live-shown.js'
import { currentTest, state } from './state.js'
import { valueCell } from './value-cell.js'

function keyHint(): HTMLElement {
  const hint = el(
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
  )

  if (state.preview.status === 'ready') {
    hint.append(' · ', el('kbd', {}, 'L'), ' live')
  }

  return hint
}

/**
 * The inspector's sections for one test: status, component props, the
 * current frame or the live section, errors.
 */
export function renderInspector(): HTMLElement[] {
  const test = currentTest()
  if (!test) {
    return []
  }

  const sections: HTMLElement[] = []

  const live = liveShown()
  const frame = test.frames[state.frame]
  // A live frame has no frame meta, so it shows the props the test rendered with.
  const frameProps = live ? undefined : (frame?.meta?.props as Record<string, unknown> | undefined)
  const props = frameProps ?? test.component?.props ?? {}

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

  sections.push(status)

  if (test.component) {
    const table = el('table', { class: 'kv' })
    for (const [key, value] of Object.entries(props)) {
      table.append(el('tr', {}, el('td', {}, key), el('td', {}, valueCell(value))))
    }

    if (!Object.keys(props).length) {
      table.append(el('tr', {}, el('td', {}, el('span', { class: 'hint' }, 'no props'))))
    }

    sections.push(el('section', {}, el('h3', {}, `component · ${test.component.name}`), table))
  }

  if (live) {
    sections.push(liveSection())
  } else if (frame) {
    sections.push(
      el(
        'section',
        {},
        el('h3', {}, `frame ${state.frame + 1} / ${test.frames.length}`),
        el('div', { class: 'mono' }, frame.label),
        el('div', { class: 'hint' }, `${frame.kind} · ${frame.at}ms into the test`),
      ),
    )
  }

  if (test.errors?.length) {
    const sec = el('section', {}, el('h3', {}, 'errors'))
    for (const error of test.errors) {
      sec.append(el('pre', { class: 'err' }, error.message))
    }

    sections.push(sec)
  }

  sections.push(el('section', {}, keyHint()))

  return sections
}
