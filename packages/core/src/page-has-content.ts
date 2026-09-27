/**
 * Whether the page shows anything at all. False for what Testing Library
 * leaves behind: an empty body after `cleanup()`, the bare container `div`
 * after `unmount()`. Any text, any other element and any attribute count as
 * content, so a styled box or an icon is never taken for an empty page.
 */
export function pageHasContent(): boolean {
  const body = document.body

  if (!body) {
    return false
  }

  if ((body.textContent ?? '').trim() !== '') {
    return true
  }

  for (const element of body.querySelectorAll('*')) {
    if (element.localName !== 'div' || element.attributes.length > 0) {
      return true
    }
  }

  return false
}
