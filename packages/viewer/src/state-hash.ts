import type { State } from './state.js'

/** The link of a view, without the `#`: the selection, the frame, the viewport size and Live. */
export function stateHash(state: State): string {
  const params = new URLSearchParams()
  if (state.suiteKey) {
    params.set('suite', state.suiteKey)
  }

  if (state.testId) {
    params.set('test', state.testId)
  }

  if (state.frame) {
    params.set('frame', String(state.frame))
  }

  if (state.viewport.width !== null) {
    params.set('w', String(state.viewport.width))
  }

  if (state.viewport.height !== null) {
    params.set('h', String(state.viewport.height))
  }

  if (state.live) {
    params.set('live', '1')
  }

  return params.toString()
}
