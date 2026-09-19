import { h } from './h.js'
import { allTests, state } from './state.js'

/** Wordmark, pass/fail counts and the time of the last run. */
export function renderHeader(): HTMLElement {
  const m = state.manifest
  const tests = m ? allTests(m) : []
  const passed = tests.filter((t) => t.state === 'passed').length
  const failed = tests.filter((t) => t.state === 'failed').length
  const summary = h('span', { class: 'summary' })
  summary.append(
    h('b', {}, String(tests.length)),
    ' tests · ',
    h('b', {}, String(passed)),
    ' passed',
  )
  if (failed) summary.append(' · ', h('b', { class: 'fail' }, String(failed)), ' failed')
  const wm = h('span', { class: 'wordmark' }, 'describe', h('span', { class: 'me' }, '-me'))
  const when = m ? new Date(m.generatedAt).toLocaleTimeString() : '…'
  return h(
    'header',
    { class: 'header' },
    wm,
    summary,
    h('span', { class: 'right live' }, `updated ${when}`),
  )
}
