/** A computed `background-image` writes each URL quoted, with `"` and `\` escaped. */
const CSS_URL = /url\("((?:[^"\\]|\\.)*)"\)/g

const PSEUDO_ELEMENTS = [null, '::before', '::after']

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function backgroundUrls(doc: Document, view: Window): string[] {
  const urls = new Set<string>()

  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const pseudo of PSEUDO_ELEMENTS) {
      const value = view.getComputedStyle(element, pseudo).backgroundImage

      for (const match of value.matchAll(CSS_URL)) {
        urls.add(match[1].replace(/\\(.)/g, '$1'))
      }
    }
  }

  return [...urls]
}

/** An image of the frame's own document, so its load goes through the frame's fetcher. */
function decoded(view: Window & typeof globalThis, url: string): Promise<void> {
  const image = new view.Image()
  image.src = url

  return image.decode().catch(() => undefined)
}

/**
 * Resolve once every `<img>` of a replayed frame has decoded or failed, and
 * every `url()` of a computed `background-image` has been loaded and decoded,
 * or after `timeoutMs`. Never rejects. Lazy images load at once, because the
 * frame grows after this wait and an image that started then would show or
 * not by chance.
 */
export async function imagesSettled(iframe: HTMLIFrameElement, timeoutMs = 10_000): Promise<void> {
  const doc = iframe.contentDocument
  const view = iframe.contentWindow as (Window & typeof globalThis) | null

  if (!doc || !view) {
    return
  }

  const images = Array.from(doc.images)

  for (const image of images) {
    if (image.loading === 'lazy') {
      image.loading = 'eager'
    }
  }

  const loads = [
    ...images.map((image) => image.decode().catch(() => undefined)),
    ...backgroundUrls(doc, view).map((url) => decoded(view, url)),
  ]

  await Promise.race([Promise.all(loads), delay(timeoutMs)])
}
