import { el } from './el.js'
import { allTests, state } from './state.js'

/** Wordmark, pass/fail counts and the time of the last run. */
export function renderHeader(): HTMLElement {
  const manifest = state.manifest
  const tests = manifest ? allTests(manifest) : []
  const passed = tests.filter((test) => test.state === 'passed').length
  const failed = tests.filter((test) => test.state === 'failed').length
  const summary = el('span', { class: 'summary' })
  summary.append(
    el('b', {}, String(tests.length)),
    ' tests · ',
    el('b', {}, String(passed)),
    ' passed',
  )

  if (failed) {
    summary.append(' · ', el('b', { class: 'fail' }, String(failed)), ' failed')
  }

  const wm = el('span', { class: 'wordmark' }, 'describe', el('span', { class: 'me' }, '-me'))
  const when = manifest ? new Date(manifest.generatedAt).toLocaleTimeString() : '…'
  return el(
    'header',
    { class: 'header' },
    wm,
    summary,
    el('span', { class: 'right live' }, `updated ${when}`),
  )
}
