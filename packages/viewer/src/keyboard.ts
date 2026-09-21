import { rerender } from './rerender.js'
import { testsInScope } from './scope.js'
import { allTests, currentTest, select, state, writeHash } from './state.js'

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

/** ← → step through frames, ↑ ↓ through tests. */
export function onKey(event: KeyboardEvent): void {
  if (!state.manifest) {
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
    writeHash()
    rerender()
  }

  if (event.key === 'ArrowLeft' && state.frame > 0) {
    state.frame--
    writeHash()
    rerender()
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const tests = allTests(state.manifest)
    const index = tests.findIndex((candidate) => candidate.id === test.id)
    const next = tests[index + (event.key === 'ArrowDown' ? 1 : -1)]
    if (next) {
      select(next.id)
    }

    event.preventDefault()
  }
}
