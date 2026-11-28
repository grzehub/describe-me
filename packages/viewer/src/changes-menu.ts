import type { ChangesReport } from '../cli/changes-report.js'
import { el } from './el.js'
import { state } from './state.js'

/** Long lists are cut here, as in the issues panel. The rest is summed up in one line. */
const LIST_LIMIT = 40

/** The non-zero counts of tests, or the words for none. */
function summaryParts(report: ChangesReport): (HTMLElement | string)[] {
  const { changed, added, removed } = report.counts.tests
  const counts = [
    [changed, 'changed'],
    [added, 'added'],
    [removed, 'removed'],
  ] as const

  const shown = counts.filter(([count]) => count > 0)

  if (shown.length === 0) {
    return ['no changed tests']
  }

  return shown.map(([count, word]) =>
    el('span', { class: 'changes-count', 'data-change': word }, el('b', {}, String(count)), word),
  )
}

/** The base run's time in local time, or as the manifest wrote it when it is no date. */
function baseTime(report: ChangesReport): string {
  const written = String(report.base.generatedAt ?? '')
  const date = new Date(written)

  return Number.isNaN(date.getTime()) ? written || 'an unknown time' : date.toLocaleString()
}

/** The removed tests by name and file, as text: they are not in this run, so nothing opens them. */
function removedSection(report: ChangesReport): HTMLElement | null {
  const removed = report.tests.filter((entry) => entry.change === 'removed')

  if (removed.length === 0) {
    return null
  }

  const items = removed
    .slice(0, LIST_LIMIT)
    .map((entry) =>
      el(
        'li',
        {},
        el('span', {}, entry.fullName),
        el('span', { class: 'issues-meta mono' }, entry.module),
      ),
    )

  const rest = removed.length - items.length
  const list = el('ul', { class: 'issues-list changes-removed' }, ...items)

  if (rest > 0) {
    list.append(el('li', { class: 'issues-more' }, `+${rest} more`))
  }

  return el(
    'section',
    { class: 'issues-section' },
    el('h3', {}, 'Removed', el('span', { class: 'issues-count' }, String(removed.length))),
    el('p', { class: 'issues-hint' }, 'In the base run and not in this one.'),
    list,
  )
}

/**
 * A header chip that counts the tests changed, added and removed against the
 * base run, and opens a panel with the base run's time, the removed tests and
 * a note when different versions of describe-me recorded the two runs.
 */
export function renderChangesMenu(report: ChangesReport): HTMLElement {
  const about = el(
    'section',
    { class: 'issues-section' },
    el('p', { class: 'changes-base' }, `Compared with the base run of ${baseTime(report)}.`),
  )

  if (report.versionsDiffer) {
    about.append(
      el(
        'p',
        { class: 'issues-hint' },
        'Different versions of describe-me recorded the two runs, so some changes may come from the update.',
      ),
    )
  }

  // Every repaint of the header rebuilds the panel, so its open state lives in `state`.
  const details = el(
    'details',
    { class: 'changes', open: state.changesOpen },
    el('summary', { title: 'against the base run' }, ...summaryParts(report)),
    el('div', { class: 'issues-panel' }, about, removedSection(report)),
  )

  details.addEventListener('toggle', () => {
    state.changesOpen = details.open
  })

  return details
}
