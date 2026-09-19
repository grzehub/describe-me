import { rerender } from './rerender.js'
import { allTests, currentTest, select, state, writeHash } from './state.js'

/** ← → step through frames, ↑ ↓ through tests. */
export function onKey(e: KeyboardEvent): void {
  const test = currentTest()
  if (!test || !state.manifest) return
  if (e.key === 'ArrowRight' && state.frame < test.frames.length - 1) {
    state.frame++
    writeHash()
    rerender()
  }
  if (e.key === 'ArrowLeft' && state.frame > 0) {
    state.frame--
    writeHash()
    rerender()
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const tests = allTests(state.manifest)
    const i = tests.findIndex((t) => t.id === test.id)
    const next = tests[i + (e.key === 'ArrowDown' ? 1 : -1)]
    if (next) select(next.id)
    e.preventDefault()
  }
}
