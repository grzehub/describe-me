import { pagePaint } from './page-paint.js'

function backgroundOf(element: Element | null, view: Window): string {
  return element ? view.getComputedStyle(element).backgroundColor : ''
}

/**
 * The color the stage's canvas takes for the same-origin page in `iframe`,
 * read from the computed `background-color` of its `html` and `body`. `null`
 * when it paints none or its document cannot be read.
 */
export function framePaint(iframe: HTMLIFrameElement): string | null {
  const frameDocument = iframe.contentDocument
  const view = frameDocument?.defaultView
  if (!frameDocument || !view) {
    return null
  }

  return pagePaint(
    backgroundOf(frameDocument.documentElement, view),
    backgroundOf(frameDocument.body, view),
  )
}
