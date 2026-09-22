import { el } from './el.js'
import { allTests, state } from './state.js'

function stat(count: number, label: string, tone?: 'pass' | 'fail'): HTMLElement {
  return el('span', { class: tone ? `stat ${tone}` : 'stat' }, el('b', {}, String(count)), label)
}

/** Wordmark, pass/fail counts and the time of the last run. */
export function renderHeader(): HTMLElement {
  const manifest = state.manifest
  const tests = manifest ? allTests(manifest) : []
  const passed = tests.filter((test) => test.state === 'passed').length
  const failed = tests.filter((test) => test.state === 'failed').length

  const summary = el('span', { class: 'summary' }, stat(tests.length, 'tests'))
  summary.append(stat(passed, 'passed', 'pass'))
  if (failed) {
    summary.append(stat(failed, 'failed', 'fail'))
  }

  const wordmark = el('span', { class: 'wordmark' }, 'describe', el('span', { class: 'me' }, '-me'))
  const when = manifest ? new Date(manifest.generatedAt).toLocaleTimeString() : '…'

  return el(
    'header',
    { class: 'header' },
    wordmark,
    summary,
    el('span', { class: 'right live' }, 'updated ', el('span', { class: 'mono' }, when)),
  )
}
