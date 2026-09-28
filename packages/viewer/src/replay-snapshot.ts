import { createMirror, rebuildIntoSandboxedIframe } from 'rrweb-snapshot'
import { previewHeadHtml } from './preview-head.js'
import { replayCache } from './replay-cache.js'
import type { SerializedNode } from './serialized-node.js'

/**
 * Rebuild a snapshot into a fresh sandboxed iframe inside `root`, with the
 * preview head at the start of its `<head>`.
 */
export function replaySnapshot(
  root: HTMLElement,
  node: SerializedNode,
  title: string,
): HTMLIFrameElement {
  const { iframe } = rebuildIntoSandboxedIframe(node, {
    root,
    iframeAttributes: { title },
    cache: replayCache(),
    mirror: createMirror(),
    hackCss: true,
  })

  const html = previewHeadHtml()
  const head = iframe.contentDocument?.head

  // First, so the captured styles win ties, as in Storybook. The sandbox
  // (`allow-same-origin` only) never runs the head's scripts.
  if (html !== '' && head) {
    head.insertAdjacentHTML('afterbegin', html)
  }

  return iframe
}
