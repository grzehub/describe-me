import { el } from './el.js'
import { liveShown } from './live-shown.js'
import { rerender } from './rerender.js'
import { currentTest, state, writeHash } from './state.js'
import { testView } from './test-view.js'

/** Fill the test view's breadcrumbs and frame timeline for the current test. A frame click leaves Live. */
export function renderMain(): void {
  const test = currentTest()
  const { path, timeline } = testView()

  path.replaceChildren()
  if (test) {
    for (const part of test.path) {
      path.append(el('span', {}, part), el('span', { class: 'sep' }, '›'))
    }

    path.append(el('span', { class: 'cur' }, test.name))
  }

  timeline.replaceChildren()
  const live = liveShown()
  test?.frames.forEach((timelineFrame, i) => {
    timeline.append(
      el(
        'button',
        {
          class: `frame ${timelineFrame.kind}${i === state.frame && !live ? ' active' : ''}`,
          click: () => {
            state.live = false
            state.frame = i
            writeHash('replace')
            rerender('frame')
          },
        },
        el('span', { class: 'k' }, timelineFrame.kind),
        el('span', { class: 'label' }, timelineFrame.label),
        el('span', { class: 't' }, `${timelineFrame.at}ms`),
      ),
    )
  })
}
