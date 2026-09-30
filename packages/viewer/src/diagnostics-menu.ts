import { manifestDiagnostics } from '@describe-me/core/diagnostics'
import type { Manifest } from '@describe-me/core/types'
import { el } from './el.js'
import { select, state } from './state.js'

/** Long lists are cut here; the rest is summed up in one line. */
const LIST_LIMIT = 40

function section(title: string, hint: string, items: HTMLElement[]): HTMLElement {
  const shown = items.slice(0, LIST_LIMIT)
  const rest = items.length - shown.length
  const list = el('ul', { class: 'issues-list' }, ...shown)

  if (rest > 0) {
    list.append(el('li', { class: 'issues-more' }, `+${rest} more`))
  }

  return el(
    'section',
    { class: 'issues-section' },
    el('h3', {}, title, el('span', { class: 'issues-count' }, String(items.length))),
    el('p', { class: 'issues-hint' }, hint),
    list,
  )
}

/** Picking an item closes the panel, and the repaint rebuilds it closed. */
function pick(testId: string): void {
  state.issuesOpen = false
  select(testId)
}

/**
 * A header chip that opens the list of what this manifest could not document:
 * problems in the test setup, anonymous components, components without props
 * docs, assets that will not load, font families that nothing loads and hosts
 * that frames load stylesheets from. Absent when there is nothing to report.
 */
export function renderDiagnosticsMenu(manifest: Manifest): HTMLElement | null {
  const { setupWarnings, anonymous, undocumented, assetsMissing, fontsMissing, remoteStylesheets } =
    manifestDiagnostics(manifest)

  const count =
    setupWarnings.length +
    anonymous.length +
    undocumented.length +
    assetsMissing.length +
    fontsMissing.length +
    remoteStylesheets.length

  if (count === 0) {
    return null
  }

  const sections: HTMLElement[] = []

  if (setupWarnings.length > 0) {
    const items = setupWarnings.map((warning) => el('li', {}, warning))

    sections.push(
      section(
        'Setup',
        'The plugin found a problem in the test setup that can make tests fail.',
        items,
      ),
    )
  }

  if (anonymous.length > 0) {
    const items = anonymous.map((test) =>
      el(
        'li',
        {},
        el('button', { class: 'issues-link', click: () => pick(test.testId) }, test.fullName),
      ),
    )

    sections.push(
      section(
        'Anonymous components',
        'Export the component from a project module (it is named after its export) or give it a displayName.',
        items,
      ),
    )
  }

  if (undocumented.length > 0) {
    const items = undocumented.map((component) =>
      el(
        'li',
        {},
        el('span', { class: 'mono' }, component.name),
        el('span', { class: 'issues-meta' }, `${component.tests} tests`),
      ),
    )

    sections.push(
      section(
        'No props docs',
        'Its props could not be read: is it exported from a TypeScript module, and is typescript installed?',
        items,
      ),
    )
  }

  if (assetsMissing.length > 0) {
    const items = assetsMissing.map((path) => el('li', { class: 'mono' }, path))

    sections.push(
      section(
        'Assets not found',
        'Not found under the project root or public/, so they will not load here.',
        items,
      ),
    )
  }

  if (fontsMissing.length > 0) {
    const items = fontsMissing.map((font) =>
      el(
        'li',
        {},
        el('button', { class: 'issues-link', click: () => pick(font.testId) }, font.family),
        el('span', { class: 'issues-meta' }, font.tests === 1 ? '1 test' : `${font.tests} tests`),
      ),
    )

    sections.push(
      section(
        'Fonts not loaded',
        'The captured CSS uses these families, but no @font-face or font stylesheet in the frames or the preview head loads them. Add them to previewHead.',
        items,
      ),
    )
  }

  if (remoteStylesheets.length > 0) {
    const items = remoteStylesheets.map((stylesheet) =>
      el(
        'li',
        {},
        el('span', { class: 'mono' }, stylesheet.host),
        el(
          'span',
          { class: 'issues-meta' },
          stylesheet.frames === 1 ? '1 frame' : `${stylesheet.frames} frames`,
        ),
      ),
    )

    sections.push(
      section(
        'Remote stylesheets',
        'Frames link these stylesheets, so they load from the network here. Put font links in previewHead instead.',
        items,
      ),
    )
  }

  // Every repaint of the header rebuilds the panel, so its open state lives in `state`.
  const details = el(
    'details',
    { class: 'issues', open: state.issuesOpen },
    el(
      'summary',
      { class: 'stat warn' },
      el('b', {}, String(count)),
      count === 1 ? 'issue' : 'issues',
    ),
    el('div', { class: 'issues-panel' }, ...sections),
  )

  details.addEventListener('toggle', () => {
    state.issuesOpen = details.open
  })

  return details
}
