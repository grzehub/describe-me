import type { State } from './state.js'

/**
 * The link of a view, without the `#`: the Foundations section, the
 * selection, the frame, the viewport size, the stage background, Live and the
 * tag filter. Live is the default, so its link has neither `frame` nor `live`,
 * and the recorded frame 0 has `live=0`.
 */
export function stateHash(state: State): string {
  const params = new URLSearchParams()
  if (state.foundations !== null) {
    params.set('foundations', state.foundations)
  }

  if (state.suiteKey) {
    params.set('suite', state.suiteKey)
  }

  if (state.testId) {
    params.set('test', state.testId)
  }

  if (!state.live && state.frame) {
    params.set('frame', String(state.frame))
  }

  if (state.viewport.width !== null) {
    params.set('w', String(state.viewport.width))
  }

  if (state.viewport.height !== null) {
    params.set('h', String(state.viewport.height))
  }

  if (state.background !== 'auto') {
    params.set('bg', state.background)
  }

  if (!state.live && !state.frame) {
    params.set('live', '0')
  }

  if (state.tag !== null) {
    params.set('tag', state.tag)
  }

  return params.toString()
}
