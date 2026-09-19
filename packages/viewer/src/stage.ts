import { createCache, createMirror, rebuildIntoSandboxedIframe } from 'rrweb-snapshot'
import type { ManifestFrame } from '@describe-me/core/types'
import { loadSnapshot } from './data.js'
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
  const { iframe } = rebuildIntoSandboxedIframe(node, {
    root: stage,
    iframeAttributes: { title: 'snapshot' },
    cache: createCache(),
    mirror: createMirror(),
    hackCss: true,
  })

  if (state.width !== 'auto') {
    iframe.style.width = `${state.width}px`
  }
}
