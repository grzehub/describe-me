/** What failed to load in a replayed frame, each list deduplicated and in document order. */
export interface FontFailures {
  families: string[]
  stylesheets: string[]
}

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

/**
 * A failed link by its host when it comes from elsewhere, by its file name
 * otherwise. Parsed URLs are compared, never substrings of them.
 */
function stylesheetName(link: HTMLLinkElement): string | null {
  let url: URL
  try {
    url = new URL(link.href)
  } catch {
    return null
  }

  if (url.origin !== location.origin) {
    return url.host
  }

  return url.pathname.split('/').pop() || url.pathname
}

/** A link that already has its sheet counts as loaded, a failed one as settled. */
function stylesheetSettled(link: HTMLLinkElement, failed: Set<HTMLLinkElement>): Promise<void> {
  if (link.sheet) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener(
      'error',
      () => {
        failed.add(link)
        resolve()
      },
      { once: true },
    )
  })
}

function stylesheetsSettled(doc: Document, failed: Set<HTMLLinkElement>): Promise<unknown> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~=stylesheet]'))

  return Promise.all(links.map((link) => stylesheetSettled(link, failed)))
}

function failures(doc: Document, failed: Set<HTMLLinkElement>): FontFailures {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~=stylesheet]'))
  const stylesheets = links
    .filter((link) => failed.has(link))
    .map((link) => stylesheetName(link))
    .filter((name) => name !== null)

  const families = Array.from(doc.fonts)
    .filter((face) => face.status === 'error')
    .map((face) => face.family.replace(/^(["'])(.*)\1$/, '$2'))

  return { families: [...new Set(families)], stylesheets: [...new Set(stylesheets)] }
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

async function settle(doc: Document, failed: Set<HTMLLinkElement>): Promise<void> {
  await stylesheetsSettled(doc, failed)
  await nextFrame()
  // rrweb reopens the document and never closes it, so `fonts.ready` may never
  // resolve. It may only end the wait early, and only from here on: raced any
  // sooner, it may have resolved before a single font started loading.
  await Promise.race([facesSettled(doc), doc.fonts.ready])
}

/**
 * Resolve once the stylesheets and web fonts of a replayed frame have loaded
 * or failed, or after `timeoutMs`, with what failed so far. Never rejects.
 * Call it right after the rebuild, before any `await`, so no stylesheet's
 * `load` or `error` event is missed.
 */
export function fontsSettled(iframe: HTMLIFrameElement, timeoutMs = 3000): Promise<FontFailures> {
  const doc = iframe.contentDocument
  if (!doc) {
    return Promise.resolve({ families: [], stylesheets: [] })
  }

  const failed = new Set<HTMLLinkElement>()

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(failures(doc, failed)), timeoutMs)

    settle(doc, failed)
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer)
        resolve(failures(doc, failed))
      })
  })
}
