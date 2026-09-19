import { rerender } from './rerender.js'
import { allTests, currentTest, select, state, writeHash } from './state.js'

/** ← → step through frames, ↑ ↓ through tests. */
export function onKey(event: KeyboardEvent): void {
  const test = currentTest()
  if (!test || !state.manifest) {
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
