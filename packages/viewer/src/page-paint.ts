import { colorBytes } from './color-bytes.js'

/** At least half opaque, the threshold at which `autoCanvas()` counts a page as painting dark. */
const MIN_ALPHA = 128

/**
 * The color the stage's canvas takes for a page whose `<html>` and `<body>`
 * compute these background colors, or `null` when it paints none. As CSS
 * propagates a background to the canvas, `html` wins when it paints at all.
 * A translucent color comes back opaque, because on a translucent canvas the
 * frame would show the page's color twice, and so a band again.
 */
export function pagePaint(html: string, body: string): string | null {
  const htmlBytes = colorBytes(html)
  const fromHtml = (htmlBytes?.[3] ?? 0) > 0
  const color = fromHtml ? html : body
  const bytes = fromHtml ? htmlBytes : colorBytes(body)

  if (!bytes) {
    return null
  }

  const [red = 0, green = 0, blue = 0, alpha = 0] = bytes

  if (alpha < MIN_ALPHA) {
    return null
  }

  // The computed string, so `oklch()` keeps the color the page paints.
  if (alpha === 255) {
    return color
  }

  return `rgb(${red}, ${green}, ${blue})`
}
