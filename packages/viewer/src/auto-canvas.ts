import { colorBytes } from './color-bytes.js'

function paintsDark(element: Element | null, view: Window): boolean {
  const bytes = element ? colorBytes(view.getComputedStyle(element).backgroundColor) : null
  if (!bytes) {
    return false
  }

  const [red = 0, green = 0, blue = 0, alpha = 0] = bytes
  const lightness = (299 * red + 587 * green + 114 * blue) / 1000

  return alpha >= 255 / 2 && lightness < 128
}

/** The one scheme the root declares, or `null` when it declares both or none. */
function declaredScheme(root: Element, view: Window): 'light' | 'dark' | null {
  const names = view.getComputedStyle(root).colorScheme.split(' ')
  const light = names.includes('light')
  const dark = names.includes('dark')

  if (light === dark) {
    return null
  }

  return dark ? 'dark' : 'light'
}

/**
 * What `auto` means for a replayed frame: dark when its root declares only a
 * dark scheme, or when `html` or `body` paints a dark `background-color`, and
 * light when its root declares only a light scheme. `null` leaves it to the
 * viewer theme, and so does a document it cannot read. A light background
 * declares nothing, because a page with a dark variant paints one in its
 * light variant too. Call it while the iframe's `color-scheme` is `light`, so
 * the page's own `prefers-color-scheme: dark` rules do not decide, and
 * neither do the viewer or the system.
 */
export function autoCanvas(iframe: HTMLIFrameElement): 'light' | 'dark' | null {
  const frameDocument = iframe.contentDocument
  const view = frameDocument?.defaultView
  if (!frameDocument || !view) {
    return null
  }

  const root = frameDocument.documentElement
  const declared = declaredScheme(root, view)

  if (declared === 'dark' || paintsDark(root, view) || paintsDark(frameDocument.body, view)) {
    return 'dark'
  }

  return declared
}
