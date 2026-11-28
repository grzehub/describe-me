import type { ManifestFrame, ManifestTest } from '@describe-me/core/types'
import type { FrameMark, RemovedFrame } from './change-marks.js'
import { changeMarks } from './change-marks.js'
import { el } from './el.js'
import { frameNextTo } from './frame-next-to.js'
import { liveShown } from './live-shown.js'
import { rerender } from './rerender.js'
import { allTests, currentTest, state, writeHash } from './state.js'
import { testView } from './test-view.js'
import { timelineEntries } from './timeline-entries.js'

/** The pill's text and title for each way a frame differs from the base. */
const FRAME_PILLS: Record<FrameMark, { text: string; title: string }> = {
  dom: { text: 'dom', title: 'the DOM differs from the base' },
  css: { text: 'css', title: 'only the CSS differs from the base' },
  added: { text: 'new', title: 'the base has no such frame' },
}

/** The pill of a frame that only the base has. */
const GONE_PILL = { text: 'gone', title: 'this run has no such frame' }

function pillOf(pill: { text: string; title: string }): HTMLElement {
  return el('span', { class: 'change-pill', title: pill.title }, pill.text)
}

/** Another frame shows After, and the frame shown keeps its side. */
function pickFrame(index: number): void {
  if (state.removedFrame !== null || index !== state.frame) {
    state.before = false
  }

  state.live = false
  state.removedFrame = null
  state.frame = index
  writeHash('replace')
  rerender('frame')
}

/** A removed frame keeps the frame next to it selected, so leaving it lands there. */
function pickRemoved(test: ManifestTest, removed: RemovedFrame): void {
  state.live = false
  state.removedFrame = removed.base.index
  state.frame = frameNextTo(test, removed)
  state.before = false
  writeHash('replace')
  rerender('frame')
}

function frameButton(
  timelineFrame: ManifestFrame,
  index: number,
  change: FrameMark | undefined,
  active: boolean,
): HTMLElement {
  // An attribute, because the class already names the frame's kind.
  const attrs: Parameters<typeof el>[1] = {
    class: `frame ${timelineFrame.kind}${active ? ' active' : ''}`,
    'data-frame': String(index),
    click: () => pickFrame(index),
  }

  if (change !== undefined) {
    attrs['data-change'] = change
  }

  return el(
    'button',
    attrs,
    el('span', { class: 'k' }, timelineFrame.kind),
    el('span', { class: 'label' }, timelineFrame.label),
    el('span', { class: 't' }, `${timelineFrame.at}ms`),
    change !== undefined && pillOf(FRAME_PILLS[change]),
  )
}

/** The base run's frame, for its kind and time, when the base manifest has the test. */
function baseFrameOf(test: ManifestTest, removed: RemovedFrame): ManifestFrame | undefined {
  const baseTest = state.baseManifest
    ? allTests(state.baseManifest).find((candidate) => candidate.id === test.id)
    : undefined

  return baseTest?.frames[removed.base.index]
}

function removedButton(test: ManifestTest, removed: RemovedFrame, active: boolean): HTMLElement {
  const baseFrame = baseFrameOf(test, removed)
  const kind = baseFrame === undefined ? '' : ` ${baseFrame.kind}`

  return el(
    'button',
    {
      class: `frame removed${kind}${active ? ' active' : ''}`,
      'data-removed': String(removed.base.index),
      'data-change': 'removed',
      click: () => pickRemoved(test, removed),
    },
    baseFrame && el('span', { class: 'k' }, baseFrame.kind),
    el('span', { class: 'label' }, removed.base.label),
    baseFrame && el('span', { class: 't' }, `${baseFrame.at}ms`),
    pillOf(GONE_PILL),
  )
}

/**
 * Fill the test view's breadcrumbs and frame timeline for the current test,
 * with the frames only the base has among them. A frame click leaves Live.
 */
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

  if (!test) {
    return
  }

  const live = liveShown()
  const changed = changeMarks(state.changes).get(test.id)?.frames

  for (const entry of timelineEntries(test)) {
    if ('removed' in entry) {
      const active = !live && state.removedFrame === entry.removed.base.index

      timeline.append(removedButton(test, entry.removed, active))
    } else {
      const active = !live && state.removedFrame === null && entry.frame === state.frame

      timeline.append(
        frameButton(test.frames[entry.frame], entry.frame, changed?.get(entry.frame), active),
      )
    }
  }
}
