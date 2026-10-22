/**
 * A viewer page for the Chromium part of check-foundations, and what its cases
 * read from the Foundations view and its specimen frame. Selectors stay inside
 * `.foundations`, because the hidden test view keeps its own background switch.
 */

const VIEW_TIMEOUT = 15_000
const POLL = 50

/** A static build without `--live` has no `__live.json`, and the viewer reads the 404 as Live off. */
function isLiveFile(url) {
  try {
    return new URL(url).pathname.endsWith('/__live.json')
  } catch {
    return false
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Open a viewer with `colorScheme: null`, because emulating a scheme would
 * force `prefers-color-scheme` in every frame and hide how the dark variant
 * gets there. Remote requests get an empty 200. Page errors, console errors of
 * any frame and same-origin responses of 400 and up land in `failures`.
 */
export async function openViewer(browser, url, options = {}) {
  const { width = 1280, height = 800, theme } = options
  const context = await browser.newContext({ colorScheme: null, viewport: { width, height } })

  if (theme) {
    await context.addInitScript(
      (stored) => localStorage.setItem('describe-me:theme', stored),
      theme,
    )
  }

  await context.route(
    (target) => target.protocol === 'https:',
    (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }),
  )

  // Cases read the specimen frame through this, inside the viewer page.
  await context.addInitScript(() => {
    globalThis.specimenFrame = () =>
      document.querySelector('.foundations .foundations-canvas iframe')
  })

  const page = await context.newPage()
  const failures = []
  const requests = []
  const origin = new URL(url).origin

  page.on('pageerror', (error) => failures.push(`page error: ${errorMessage(error)}`))
  page.on('console', (message) => {
    if (message.type() === 'error' && !isLiveFile(message.location().url)) {
      failures.push(`console error: ${message.text()}`)
    }
  })

  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  page.on('response', (response) => {
    const target = new URL(response.url())

    if (target.origin === origin && response.status() >= 400 && !isLiveFile(response.url())) {
      failures.push(`${response.status()} for ${target.pathname}`)
    }
  })

  return {
    page,
    failures,
    /** Requests for `foundations.json` so far. */
    foundationsRequests: () => requests.filter((path) => path.endsWith('/foundations.json')).length,
    close: () => context.close(),
  }
}

/** Load the viewer at `hash` and wait for its sidebar. */
export async function gotoViewer(viewer, url, hash = '') {
  await viewer.page.goto(`${url}${hash}`)
  // Attached, not visible: on a narrow window the sidebar starts hidden.
  await viewer.page
    .locator('.tree .test')
    .first()
    .waitFor({ state: 'attached', timeout: VIEW_TIMEOUT })
}

/** Change the link as a user would, which the viewer reads on `hashchange`. */
export async function setHash(page, hash) {
  await page.evaluate((next) => {
    location.hash = next
  }, hash)
}

/** The link's parameters as an object. */
export function hashParams(page) {
  return page.evaluate(() => Object.fromEntries(new URLSearchParams(location.hash.slice(1))))
}

/**
 * Wait until the specimen frame shows `section` with the iframe's scheme
 * `scheme`. Each section or background change builds a new frame.
 */
export async function waitForFrame(page, section, scheme = 'light') {
  await page.waitForFunction(
    ([id, colorScheme]) => {
      const iframe = globalThis.specimenFrame()
      const root = iframe?.contentDocument?.querySelector('.fd-root')

      return iframe?.style.colorScheme === colorScheme && root?.dataset.section === id
    },
    [section, scheme],
    { timeout: VIEW_TIMEOUT, polling: POLL },
  )
}

/** The section buttons as `[title, count]` pairs, in toolbar order. */
export function sectionButtons(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.foundations .foundations-sections button')).map(
      (button) => {
        const count = button.querySelector('.count')?.textContent ?? ''

        return [button.textContent.slice(0, -count.length), Number(count)]
      },
    ),
  )
}

/** Wait until no face of the specimen frame is loading, then for the refit after it. */
export async function waitForFonts(page) {
  await page.waitForFunction(
    () => {
      const doc = globalThis.specimenFrame()?.contentDocument

      return doc && Array.from(doc.fonts).every((face) => face.status !== 'loading')
    },
    undefined,
    { timeout: VIEW_TIMEOUT, polling: POLL },
  )

  await page.waitForTimeout(300)
}
