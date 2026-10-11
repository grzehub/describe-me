/**
 * The live page before Vite's HTML transforms: the preview head, when it is
 * not blank, and the generated entry at `entrySrc`, which runs the test.
 */
export function livePageHtml(previewHead: string | undefined, entrySrc: string): string {
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
    `    <script type="module" src="${entrySrc}"></script>`,
    '  </body>',
    '</html>',
    '',
  ].join('\n')
}
