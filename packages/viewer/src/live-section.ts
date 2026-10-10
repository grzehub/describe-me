import { el } from './el.js'
import type { LiveAction } from './live-session.js'
import { liveSession } from './live-session.js'
import { liveStatusWords } from './live-status-words.js'
import { rerender } from './rerender.js'

/** The status dot's class, as the sidebar colours a test. */
function dotClass(status: typeof liveSession.status): string {
  if (status === 'loading') {
    return 'pending'
  }

  return status === 'mounted' ? 'passed' : 'failed'
}

function actionText(action: LiveAction): string {
  return `${action.name}(${action.args.join(', ')})`
}

function restart(): void {
  liveSession.restarts += 1
  rerender('frame')
}

function actionList(): HTMLElement {
  if (liveSession.actions.length === 0) {
    return el('div', { class: 'hint' }, 'Calls of vi.fn() props show here.')
  }

  const list = el('ol', { class: 'live-actions' })

  for (const action of liveSession.actions) {
    list.append(el('li', {}, actionText(action)))
  }

  return list
}

/**
 * The inspector's section for the test mounted live: its status and the
 * reason, Restart, the calls of its `vi.fn()` props, the errors it threw and
 * the notices of the live page.
 */
export function liveSection(): HTMLElement {
  const { status, detail, errors, notices } = liveSession
  const section = el(
    'section',
    { class: 'live-section' },
    el('h3', {}, 'live'),
    el(
      'div',
      { class: 'live-head' },
      el(
        'div',
        { class: 'live-status' },
        el('span', { class: `dot ${dotClass(status)}` }),
        liveStatusWords[status],
      ),
      el(
        'button',
        { class: 'live-restart', type: 'button', title: 'Mount it again, fresh', click: restart },
        'Restart',
      ),
    ),
  )

  if (detail) {
    section.append(el('pre', { class: 'err' }, detail))
  }

  section.append(el('h4', {}, 'actions'), actionList())

  if (errors.length > 0) {
    section.append(el('h4', {}, 'errors'))
    section.append(...errors.map((message) => el('pre', { class: 'err' }, message)))
  }

  if (notices.length > 0) {
    section.append(el('h4', {}, 'notices'))
    section.append(...notices.map((message) => el('div', { class: 'hint live-notice' }, message)))
  }

  return section
}
