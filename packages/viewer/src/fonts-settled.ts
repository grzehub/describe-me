/**
 * Wait until the next frame has been styled and laid out. A frame callback
 * runs before that, the timeout after it, when the fonts that freshly loaded
 * rules need have started loading.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0))
  })
}

/** A link that already has its sheet counts as loaded, a failed one as settled. */
function stylesheetSettled(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
  })
}

function stylesheetsSettled(doc: Document): Promise<unknown> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~=stylesheet]'))

  return Promise.all(links.map((link) => stylesheetSettled(link)))
}

function loadingFacesSettled(doc: Document): Promise<unknown> {
  const loading = Array.from(doc.fonts).filter((face) => face.status === 'loading')

  return Promise.allSettled(loading.map((face) => face.loaded))
}

async function facesSettled(doc: Document): Promise<void> {
  await loadingFacesSettled(doc)
  // A second pass for the faces that started while the first ones loaded.
  await nextFrame()
  await loadingFacesSettled(doc)
}

async function settle(doc: Document): Promise<void> {
  await stylesheetsSettled(doc)
  await nextFrame()
  // rrweb reopens the document and never closes it, so `fonts.ready` may never
  // resolve. It may only end the wait early, and only from here on: raced any
  // sooner, it may have resolved before a single font started loading.
  await Promise.race([facesSettled(doc), doc.fonts.ready])
}

/**
 * Resolve once the stylesheets and web fonts of a replayed frame have loaded
 * or failed, or after `timeoutMs`. Never rejects. Call it right after the
 * rebuild, before any `await`, so no stylesheet's `load` event is missed.
 */
export function fontsSettled(iframe: HTMLIFrameElement, timeoutMs = 3000): Promise<void> {
  const doc = iframe.contentDocument
  if (!doc) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)

    settle(doc)
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer)
        resolve()
      })
  })
}
