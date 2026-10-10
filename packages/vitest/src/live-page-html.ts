import { LIVE_MODULE_IDS } from './live-module-ids.js'

/** How Vite serves a module id that starts with `\0`. */
const ENTRY_URL = `/@id/__x00__${LIVE_MODULE_IDS.entry.slice(1)}`

/**
 * The live page before Vite's HTML transforms: the preview head, when it is
 * not blank, and the generated entry, which runs the test.
 */
export function livePageHtml(previewHead: string | undefined): string {
  const head = previewHead?.trim() ? [`    ${previewHead.trim()}`] : []

  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8">',
    ...head,
    '    <title>describe-me live preview</title>',
    '  </head>',
    '  <body>',
    `    <script type="module" src="${ENTRY_URL}"></script>`,
    '  </body>',
    '</html>',
    '',
  ].join('\n')
}
