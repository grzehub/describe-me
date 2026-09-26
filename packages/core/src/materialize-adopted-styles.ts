/**
 * Constructable stylesheets (`document.adoptedStyleSheets`, used by Lit and
 * other web-component libraries) are not part of the DOM tree, so rrweb's
 * snapshot never sees them. For the duration of `run`, mirror their rules into
 * a temporary `<style>` element so they end up in the capture. Synchronous,
 * like rrweb's snapshot, so a `settle: false` capture records its frame before
 * `recorder.capture()` returns.
 */
export function materializeAdoptedStyles<T>(run: () => T): T {
  const sheets = document.adoptedStyleSheets ?? []
  if (sheets.length === 0) {
    return run()
  }

  const mirror = document.createElement('style')
  mirror.setAttribute('data-describe-me', 'adopted-styles')
  mirror.textContent = sheets
    .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
    .join('\n')

  document.head.append(mirror)

  try {
    return run()
  } finally {
    mirror.remove()
  }
}
