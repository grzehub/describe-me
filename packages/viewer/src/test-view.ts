import { el } from './el.js'
import { renderViewportControls } from './viewport-controls.js'

export interface TestView {
  main: HTMLElement
  /** The breadcrumbs, before the viewport toolbar. */
  path: HTMLElement
  /** The scroll container. It never leaves the DOM, because a moved iframe reloads blank. */
  stage: HTMLElement
  /** A one-cell grid inside the stage that holds the slots. */
  frames: HTMLElement
  /** Names what failed to load in the frame on the stage. Hidden when nothing did. */
  note: HTMLElement
  timeline: HTMLElement
}

let built: TestView | null = null

/**
 * The column that shows one test: crumbs and toolbar, the replay stage, a note
 * on what failed to load and the frame timeline. Built once, then filled in place.
 */
export function testView(): TestView {
  if (built) {
    return built
  }

  const path = el('span', { class: 'path' })
  const frames = el('div', { class: 'stage-frames' })
  const stage = el('div', { class: 'stage' }, frames)
  const note = el('div', { class: 'stage-note', role: 'status', hidden: true })
  const timeline = el('div', { class: 'timeline' })
  const crumbs = el('div', { class: 'crumbs' }, path, renderViewportControls())
  const main = el('main', { class: 'main' }, crumbs, stage, note, timeline)

  built = { main, path, stage, frames, note, timeline }

  return built
}
