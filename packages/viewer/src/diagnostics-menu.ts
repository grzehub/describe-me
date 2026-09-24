import { manifestDiagnostics } from '@describe-me/core/diagnostics'
import type { Manifest } from '@describe-me/core/types'
import { el } from './el.js'
import { select } from './state.js'

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

/**
 * A header chip that opens the list of what this manifest could not document:
 * anonymous components, components without props docs and assets that will not
 * load. Absent when there is nothing to report.
 */
export function renderDiagnosticsMenu(manifest: Manifest): HTMLElement | null {
  const { anonymous, undocumented, assetsMissing } = manifestDiagnostics(manifest)
  const count = anonymous.length + undocumented.length + assetsMissing.length

  if (count === 0) {
    return null
  }

  const sections: HTMLElement[] = []

  if (anonymous.length > 0) {
    const items = anonymous.map((test) =>
      el(
        'li',
        {},
        el('button', { class: 'issues-link', click: () => select(test.testId) }, test.fullName),
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

  return el(
    'details',
    { class: 'issues' },
    el(
      'summary',
      { class: 'stat warn' },
      el('b', {}, String(count)),
      count === 1 ? 'issue' : 'issues',
    ),
    el('div', { class: 'issues-panel' }, ...sections),
  )
}
