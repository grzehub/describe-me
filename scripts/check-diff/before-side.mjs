/**
 * A viewer page of `describe-me dev --base` for check-diff's scenario 31,
 * opened on the Before side of a test: what its frame says, which snapshots
 * came from `/__base/snapshots/`, and what `B` shows.
 */
const SIDE_TIMEOUT = 20_000

/** The text of the frame on the stage once it shows the side of `before`. */
async function frameText(page, id, before) {
  const side = before ? '[data-side="before"]' : ':not([data-side])'
  const slot = `.stage-slot[data-test="${id}"]${side}:not(.incoming)`

  await page.locator(`${slot} iframe`).waitFor({ state: 'visible', timeout: SIDE_TIMEOUT })

  return page.evaluate(
    (target) =>
      document.querySelector(`${target} iframe`)?.contentDocument?.body?.textContent?.trim() ??
      null,
    slot,
  )
}

/**
 * Opens `#test=<id>&live=0&before=1` in a new page. Returns the text of the
 * Before side, the paths it fetched under `/__base/snapshots/`, and the text
 * of the frame that `B` shows.
 */
export async function beforeSide(browser, url, id) {
  const page = await browser.newPage()
  const baseSnapshots = []

  page.on('response', (response) => {
    const { pathname } = new URL(response.url())

    if (pathname.startsWith('/__base/snapshots/') && response.ok()) {
      baseSnapshots.push(pathname)
    }
  })

  try {
    await page.goto(`${url}#test=${id}&live=0&before=1`)

    const before = await frameText(page, id, true)

    // The click on the breadcrumbs takes the focus off the frame, so the key reaches the viewer.
    await page.locator('.crumbs .path').click()
    await page.keyboard.press('b')

    return { before, baseSnapshots, after: await frameText(page, id, false) }
  } finally {
    await page.close()
  }
}
