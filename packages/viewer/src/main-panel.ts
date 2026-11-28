import type { FrameMark } from './change-marks.js'
import { changeMarks } from './change-marks.js'
import { el } from './el.js'
import { liveShown } from './live-shown.js'
import { rerender } from './rerender.js'
import { currentTest, state, writeHash } from './state.js'
import { testView } from './test-view.js'

/** The pill's text and title for each way a frame differs from the base. */
const FRAME_PILLS: Record<FrameMark, { text: string; title: string }> = {
  dom: { text: 'dom', title: 'the DOM differs from the base' },
  css: { text: 'css', title: 'only the CSS differs from the base' },
  added: { text: 'new', title: 'the base has no such frame' },
}

/** Fill the test view's breadcrumbs and frame timeline for the current test. A frame click leaves Live. */
export function renderMain(): void {
  const test = currentTest()
  const { path, timeline } = testView()

  path.replaceChildren()
  path.title = test ? [...test.path, test.name].join(' › ') : ''
  if (test) {
    const parents = el('span', { class: 'parents' })
    for (const part of test.path) {
      parents.append(el('span', {}, part), el('span', { class: 'sep' }, '›'))
    }

    path.append(parents, el('span', { class: 'cur' }, test.name))
  }

  timeline.replaceChildren()
  const live = liveShown()
  const changed = test ? changeMarks(state.changes).get(test.id)?.frames : undefined
  test?.frames.forEach((timelineFrame, i) => {
    const change = changed?.get(i)
    const pill = change === undefined ? undefined : FRAME_PILLS[change]
    // An attribute, because the class already names the frame's kind.
    const attrs: Parameters<typeof el>[1] = {
      class: `frame ${timelineFrame.kind}${i === state.frame && !live ? ' active' : ''}`,
      click: () => {
        state.live = false
        state.frame = i
        writeHash('replace')
        rerender('frame')
      },
    }

    if (change !== undefined) {
      attrs['data-change'] = change
    }

    timeline.append(
      el(
        'button',
        attrs,
        el('span', { class: 'k' }, timelineFrame.kind),
        el('span', { class: 'label' }, timelineFrame.label),
        el('span', { class: 't' }, `${timelineFrame.at}ms`),
        pill && el('span', { class: 'change-pill', title: pill.title }, pill.text),
      ),
    )
  })
}
