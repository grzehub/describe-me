import { renderDiagnosticsMenu } from './diagnostics-menu.js'
import { el } from './el.js'
import { allTests, state } from './state.js'

function stat(count: number, label: string, tone?: 'pass' | 'fail'): HTMLElement {
  return el('span', { class: tone ? `stat ${tone}` : 'stat' }, el('b', {}, String(count)), label)
}

/** The sygnet, which the stylesheet draws, and the project's name, or the wordmark when the manifest has none. */
function brand(project: string | undefined): HTMLElement {
  if (project !== undefined) {
    return el('span', { class: 'wordmark' }, project)
  }

  return el('span', { class: 'wordmark' }, 'describe', el('span', { class: 'me' }, '(me)'))
}

/**
 * The header's children: the brand, pass/fail counts, what could not be
 * documented and the time of the last run.
 */
export function renderHeader(): HTMLElement[] {
  const manifest = state.manifest
  const tests = manifest ? allTests(manifest) : []
  const passed = tests.filter((test) => test.state === 'passed').length
  const failed = tests.filter((test) => test.state === 'failed').length

  const summary = el('span', { class: 'summary' }, stat(tests.length, 'tests'))
  summary.append(stat(passed, 'passed', 'pass'))
  if (failed) {
    summary.append(stat(failed, 'failed', 'fail'))
  }

  const wordmark = brand(manifest?.project)
  const when = manifest ? new Date(manifest.generatedAt).toLocaleTimeString() : '…'
  const issues = manifest ? renderDiagnosticsMenu(manifest) : null
  const updated = el(
    'span',
    { class: 'right live' },
    'updated ',
    el('span', { class: 'mono' }, when),
  )

  return [wordmark, summary, issues, updated].filter(
    (child): child is HTMLElement => child !== null,
  )
}
