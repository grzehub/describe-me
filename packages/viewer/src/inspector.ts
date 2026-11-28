import type { ManifestFrame, ManifestTest } from '@describe-me/core/types'
import type { FrameSide } from '../cli/changes-report.js'
import { collapseProps } from './collapse-props.js'
import { el } from './el.js'
import { frameSides } from './frame-sides.js'
import { liveSection } from './live-section.js'
import { liveShown } from './live-shown.js'
import { currentTest, state } from './state.js'
import { tagButtons } from './tag-buttons.js'
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

  const sides = frameSides()

  if (sides?.before && sides.after) {
    hint.append(' · ', el('kbd', {}, 'B'), ' before / after')
  }

  return hint
}

function removedSection(removed: FrameSide): HTMLElement {
  return el(
    'section',
    {},
    el('h3', {}, 'removed frame'),
    el('div', { class: 'mono' }, removed.label),
    el('div', { class: 'hint' }, 'in the base run, not in this one'),
  )
}

/** The frame on screen, or on the Before side the base run's frame it replaced. */
function frameSection(test: ManifestTest, frame: ManifestFrame): HTMLElement {
  const sides = frameSides()
  const heading = `frame ${state.frame + 1} / ${test.frames.length}`

  if (sides?.before && state.before) {
    return el(
      'section',
      {},
      el('h3', {}, `${heading} · before`),
      el('div', { class: 'mono' }, sides.before.label),
      el('div', { class: 'hint' }, 'in the base run'),
    )
  }

  return el(
    'section',
    {},
    el('h3', {}, heading),
    el('div', { class: 'mono' }, frame.label),
    el('div', { class: 'hint' }, `${frame.kind} · ${frame.at}ms into the test`),
  )
}

/** The props the component got, folded when there are many. Frames and Live of a test share the fold. */
function propsSection(
  test: ManifestTest,
  name: string,
  props: Record<string, unknown>,
): HTMLElement {
  const section = el('section', {}, el('h3', {}, `component · ${name}`))
  const table = el('table', { class: 'kv' })
  const entries = Object.entries(props)

  if (!entries.length) {
    table.append(el('tr', {}, el('td', {}, el('span', { class: 'hint' }, 'no props'))))
    section.append(table)

    return section
  }

  const rows = entries.map(([key, value]) =>
    el('tr', {}, el('td', {}, key), el('td', {}, valueCell(value))),
  )

  section.append(...collapseProps(table, rows, `test:${test.id}`))

  return section
}

/** The frame only the base has, when the stage shows one. */
function removedShown(): FrameSide | null {
  const sides = frameSides()

  return sides?.before && !sides.after ? sides.before : null
}

/**
 * The inspector's sections for one test: status and tags, component props,
 * the current frame, a removed frame or the live section, errors.
 */
export function renderInspector(): HTMLElement[] {
  const test = currentTest()
  if (!test) {
    return []
  }

  const sections: HTMLElement[] = []

  const live = liveShown()
  const removed = removedShown()
  const frame = test.frames[state.frame]
  // Live and a removed frame have no frame meta, so they show the props the test rendered with.
  const frameProps =
    live || removed ? undefined : (frame?.meta?.props as Record<string, unknown> | undefined)

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

  const tags = tagButtons(test)
  if (tags) {
    status.append(tags)
  }

  sections.push(status)

  if (test.component) {
    sections.push(propsSection(test, test.component.name, props))
  }

  if (live) {
    sections.push(liveSection())
  } else if (removed) {
    sections.push(removedSection(removed))
  } else if (frame) {
    sections.push(frameSection(test, frame))
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
