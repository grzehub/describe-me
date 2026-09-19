import { el } from './el.js'
import { rerender } from './rerender.js'
import { paintFrame } from './stage.js'
import { currentTest, state, writeHash } from './state.js'

/** Breadcrumbs, viewport buttons, the replay stage and the frame timeline. */
export function renderMain(): HTMLElement {
  const test = currentTest()
  const frame = test?.frames[state.frame]

  const crumbs = el('div', { class: 'crumbs' })
  if (test) {
    for (const part of test.path) {
      crumbs.append(el('span', {}, part), el('span', { class: 'sep' }, '›'))
    }

    crumbs.append(el('span', { class: 'cur' }, test.name))
  }

  const tools = el('div', { class: 'tools' })
  for (const width of ['auto', '768', '375'] as const) {
    tools.append(
      el(
        'button',
        {
          class: state.width === width ? 'on' : '',
          click: () => {
            state.width = width
            rerender()
          },
        },
        width === 'auto' ? '100%' : `${width}px`,
      ),
    )
  }

  crumbs.append(tools)

  const stage = el('div', { class: 'stage' })
  if (frame) {
    void paintFrame(stage, frame)
  } else {
    stage.append(
      el('div', { class: 'empty' }, test ? 'no frames recorded for this test' : 'select a test'),
    )
  }

  const timeline = el('div', { class: 'timeline' })
  test?.frames.forEach((timelineFrame, i) => {
    timeline.append(
      el(
        'button',
        {
          class: `frame ${timelineFrame.kind}${i === state.frame ? ' active' : ''}`,
          click: () => {
            state.frame = i
            writeHash()
            rerender()
          },
        },
        el('span', { class: 'k' }, timelineFrame.kind),
        el('span', {}, timelineFrame.label),
        el('span', { class: 't' }, `${timelineFrame.at}ms`),
      ),
    )
  })

  return el('main', { class: 'main' }, crumbs, stage, timeline)
}
