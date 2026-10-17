import { createMirror, rebuildIntoSandboxedIframe } from 'rrweb-snapshot'
import { previewHeadHtml } from './preview-head.js'
import { replayCache } from './replay-cache.js'
import type { SerializedNode } from './serialized-node.js'

/**
 * No specificity and first in `<head>`, so any `html` or `:root` rule of the
 * page wins and a page that declares its own scheme keeps it.
 */
const SCHEME_RULE = '<style>:where(:root) { color-scheme: light dark }</style>'

/**
 * Rebuild a snapshot into a fresh sandboxed iframe inside `root`, with a light
 * `color-scheme` on the iframe. Its `<head>` starts with a rule that gives the
 * document the iframe's scheme, then the preview head.
 */
export function replaySnapshot(
  root: HTMLElement,
  node: SerializedNode,
  title: string,
): HTMLIFrameElement {
  // rrweb sets these before it appends the iframe, so the frame never lays out
  // in the viewer's scheme.
  const { iframe } = rebuildIntoSandboxedIframe(node, {
    root,
    iframeAttributes: { title, style: 'color-scheme: light' },
    cache: replayCache(),
    mirror: createMirror(),
    hackCss: true,
  })

  const head = iframe.contentDocument?.head

  // The rule gives the document the iframe's scheme. The two match, so Chromium
  // paints no opaque backdrop under the page. packages/vitest/src/live-page-html.ts
  // has a copy. The preview head comes next, so the captured styles win ties,
  // as in Storybook. The sandbox (`allow-same-origin` only) never runs its scripts.
  if (head) {
    head.insertAdjacentHTML('afterbegin', `${SCHEME_RULE}${previewHeadHtml()}`)
  }

  return iframe
}
