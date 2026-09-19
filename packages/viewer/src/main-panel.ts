import { h } from './h.js'
import { rerender } from './rerender.js'
import { paintFrame } from './stage.js'
import { currentTest, state, writeHash } from './state.js'

/** Breadcrumbs, viewport buttons, the replay stage and the frame timeline. */
export function renderMain(): HTMLElement {
  const test = currentTest()
  const frame = test?.frames[state.frame]

  const crumbs = h('div', { class: 'crumbs' })
  if (test) {
    for (const p of test.path) crumbs.append(h('span', {}, p), h('span', { class: 'sep' }, '›'))
    crumbs.append(h('span', { class: 'cur' }, test.name))
  }
  const tools = h('div', { class: 'tools' })
  for (const w of ['auto', '768', '375'] as const) {
    tools.append(
      h(
        'button',
        {
          class: state.width === w ? 'on' : '',
          click: () => {
            state.width = w
            rerender()
          },
        },
        w === 'auto' ? '100%' : `${w}px`,
      ),
    )
  }
  crumbs.append(tools)

  const stage = h('div', { class: 'stage' })
  if (frame) {
    void paintFrame(stage, frame)
  } else {
    stage.append(
      h('div', { class: 'empty' }, test ? 'no frames recorded for this test' : 'select a test'),
    )
  }

  const timeline = h('div', { class: 'timeline' })
  test?.frames.forEach((f, i) => {
    timeline.append(
      h(
        'button',
        {
          class: `frame ${f.kind}${i === state.frame ? ' active' : ''}`,
          click: () => {
            state.frame = i
            writeHash()
            rerender()
          },
        },
        h('span', { class: 'k' }, f.kind),
        h('span', {}, f.label),
        h('span', { class: 't' }, `${f.at}ms`),
      ),
    )
  })

  return h('main', { class: 'main' }, crumbs, stage, timeline)
}
