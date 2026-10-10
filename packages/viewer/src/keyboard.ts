import type { ManifestTest } from '@describe-me/core/types'
import { liveShown } from './live-shown.js'
import { regions } from './regions.js'
import { rerender } from './rerender.js'
import { testsInScope } from './scope.js'
import { sidebarOrder } from './sidebar-order.js'
import { currentTest, select, state, writeHash } from './state.js'
import { toggleLive } from './toggle-live.js'
import { visibleTests } from './visible-tests.js'

/** In the overview, ↑ ↓ jump into the scope: the first or the last test it holds. */
function onSuiteKey(event: KeyboardEvent, key: string): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  const tests = testsInScope(key)
  const next = event.key === 'ArrowDown' ? tests[0] : tests[tests.length - 1]
  if (next) {
    select(next.id)
  }

  event.preventDefault()
}

/** The first test after `id` in sidebar order, going by `step`, that the sidebar shows. */
function nearestShown(shown: ManifestTest[], id: string, step: 1 | -1): ManifestTest | undefined {
  const shownIds = new Set(shown.map((test) => test.id))
  const order = sidebarOrder()
  const start = order.findIndex((candidate) => candidate.id === id)
  const ahead = step === 1 ? order.slice(start + 1) : order.slice(0, Math.max(0, start)).reverse()

  return ahead.find((candidate) => shownIds.has(candidate.id))
}

/**
 * The next or previous test the sidebar shows. From a test hidden in a
 * collapsed suite, that is the nearest shown row in sidebar order. From a test
 * the search does not match, ↓ enters at the first match and ↑ at the last.
 */
function neighbour(id: string, step: 1 | -1): ManifestTest | undefined {
  const tests = visibleTests()
  const index = tests.findIndex((candidate) => candidate.id === id)
  if (index >= 0) {
    return tests[index + step]
  }

  if (state.query.trim() === '') {
    return nearestShown(tests, id, step)
  }

  return step === 1 ? tests[0] : tests[tests.length - 1]
}

/** Arrow keys move the caret or the value in a field, so shortcuts stay out of the way there. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || target.matches('input, textarea, select')
}

/** With Ctrl, Meta or Alt, `/` belongs to the browser. */
function isSearchKey(event: KeyboardEvent): boolean {
  return event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
}

/** `L` in either case, without Ctrl, Meta or Alt, and not held down. */
function isLiveKey(event: KeyboardEvent): boolean {
  const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat

  return plain && event.key.toLowerCase() === 'l'
}

/**
 * While Live shows, ← → leave it and show the frame as it was. Otherwise they
 * step, and a link still waiting for the preview stays out of Live.
 */
function onFrameKey(test: ManifestTest, step: 1 | -1): void {
  const leaving = liveShown()
  const next = state.frame + step
  const steps = !leaving && next >= 0 && next < test.frames.length

  if (!leaving && !steps && !state.live) {
    return
  }

  state.live = false

  if (steps) {
    state.frame = next
  }

  writeHash('replace')
  rerender('frame')
}

/**
 * ← → step through frames, ↑ ↓ through the tests the sidebar shows, `L`
 * toggles Live, `/` focuses the search.
 */
export function onKey(event: KeyboardEvent): void {
  if (!state.manifest || isTyping(event.target)) {
    return
  }

  if (isSearchKey(event)) {
    const { search } = regions()
    search.focus()
    search.select()
    event.preventDefault()
    return
  }

  if (state.suiteKey) {
    onSuiteKey(event, state.suiteKey)
    return
  }

  const test = currentTest()
  if (!test) {
    return
  }

  if (isLiveKey(event)) {
    toggleLive()
    event.preventDefault()
    return
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    onFrameKey(test, event.key === 'ArrowRight' ? 1 : -1)
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const next = neighbour(test.id, event.key === 'ArrowDown' ? 1 : -1)
    if (next) {
      select(next.id, 0, 'replace')
    }

    event.preventDefault()
  }
}
