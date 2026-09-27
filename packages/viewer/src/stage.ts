import type { ManifestFrame } from '@describe-me/core/types'
import { loadSnapshot } from './data.js'
import { fitStage } from './fit-stage.js'
import { fontsSettled } from './fonts-settled.js'
import { replaySnapshot } from './replay-snapshot.js'
import { state } from './state.js'

let paintToken = 0

/** Replay a snapshot into a fresh sandboxed iframe inside `stage`. */
export async function paintFrame(stage: HTMLElement, frame: ManifestFrame): Promise<void> {
  const token = ++paintToken
  const node = await loadSnapshot(frame.snapshot)
  if (token !== paintToken) {
    return
  }

  stage.replaceChildren()
  const iframe = replaySnapshot(stage, node, 'snapshot')
  const fonts = fontsSettled(iframe)

  if (state.width !== 'auto') {
    iframe.style.width = `${state.width}px`
  }

  // Styles are in place after a frame; only then do the boxes have their final size.
  requestAnimationFrame(() => {
    if (token === paintToken) {
      fitStage(iframe)
    }
  })

  // Web fonts arrive later and change the text's size.
  await fonts
  if (token === paintToken) {
    fitStage(iframe)
  }
}
