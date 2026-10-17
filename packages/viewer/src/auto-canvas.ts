let probe: CanvasRenderingContext2D | null = null

function probeContext(): CanvasRenderingContext2D | null {
  if (!probe) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    probe = canvas.getContext('2d', { willReadFrequently: true })
  }

  return probe
}

/**
 * The sRGB bytes of a CSS color, alpha last. The canvas parses every syntax
 * the browser knows, `oklch()` and `color()` included. A `fillStyle` it
 * rejects keeps the previous one, so an unknown color reads as transparent.
 */
function colorBytes(color: string): Uint8ClampedArray | null {
  const context = probeContext()
  if (!context) {
    return null
  }

  context.clearRect(0, 0, 1, 1)
  context.fillStyle = 'transparent'
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)

  return context.getImageData(0, 0, 1, 1).data
}

function paintsDark(element: Element | null, view: Window): boolean {
  const bytes = element ? colorBytes(view.getComputedStyle(element).backgroundColor) : null
  if (!bytes) {
    return false
  }

  const [red = 0, green = 0, blue = 0, alpha = 0] = bytes
  const lightness = (299 * red + 587 * green + 114 * blue) / 1000

  return alpha >= 255 / 2 && lightness < 128
}

function declaresDark(root: Element, view: Window): boolean {
  const names = view.getComputedStyle(root).colorScheme.split(' ')

  return names.includes('dark') && !names.includes('light')
}

/**
 * What `auto` means for a replayed frame: dark when its root declares only a
 * dark scheme, or when `html` or `body` paints a dark `background-color`.
 * Call it while the iframe's `color-scheme` is `light`, so the page's own
 * `prefers-color-scheme: dark` rules do not decide, and neither do the viewer
 * or the system. A document it cannot read is light.
 */
export function autoCanvas(iframe: HTMLIFrameElement): 'light' | 'dark' {
  const frameDocument = iframe.contentDocument
  const view = frameDocument?.defaultView
  if (!frameDocument || !view) {
    return 'light'
  }

  const root = frameDocument.documentElement
  const dark =
    declaresDark(root, view) || paintsDark(root, view) || paintsDark(frameDocument.body, view)

  return dark ? 'dark' : 'light'
}
