import type { ManifestTest } from '@describe-me/core/types'
import { regions } from './regions.js'
import { rerender } from './rerender.js'
import { testsInScope } from './scope.js'
import { currentTest, select, state, writeHash } from './state.js'
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

/** The next or previous test in the list. From outside it, ↓ enters at the top and ↑ at the bottom. */
function neighbour(tests: ManifestTest[], id: string, step: 1 | -1): ManifestTest | undefined {
  const index = tests.findIndex((candidate) => candidate.id === id)
  if (index < 0) {
    return step === 1 ? tests[0] : tests[tests.length - 1]
  }

  return tests[index + step]
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

/** ← → step through frames, ↑ ↓ through the tests the sidebar shows, `/` focuses the search. */
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

  if (event.key === 'ArrowRight' && state.frame < test.frames.length - 1) {
    state.frame++
    writeHash('replace')
    rerender('frame')
  }

  if (event.key === 'ArrowLeft' && state.frame > 0) {
    state.frame--
    writeHash('replace')
    rerender('frame')
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const next = neighbour(visibleTests(), test.id, event.key === 'ArrowDown' ? 1 : -1)
    if (next) {
      select(next.id)
    }

    event.preventDefault()
  }
}
