/** The viewer's origin from the page URL, when it is exactly the origin of an http(s) URL. */
export function viewerOrigin(): string | null {
  const origin = new URLSearchParams(window.location.search).get('origin')

  if (origin === null) {
    return null
  }

  try {
    const url = new URL(origin)
    const web = url.protocol === 'http:' || url.protocol === 'https:'

    return web && url.origin === origin ? origin : null
  } catch {
    return null
  }
}
