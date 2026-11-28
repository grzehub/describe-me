/**
 * A viewer page of `describe-me dev` for check-diff's scenario 31, which
 * waits for the number of changed tests in the header and tells whether the
 * page reloaded since it opened.
 */
const COUNT_TIMEOUT = 20_000

/** Opens the viewer at `url` in a new page and marks the document, so a reload shows. */
export async function openCountPage(browser, url) {
  const page = await browser.newPage()

  await page.goto(url)
  await page.locator('.tree .test').first().waitFor({ timeout: COUNT_TIMEOUT })
  await page.evaluate(() => {
    window.describeMeOpened = true
  })

  return page
}

/**
 * Whether the header comes to say `count` changed, without a reload, within
 * the timeout. Returns what it says when it does not.
 */
export async function showsChangedCount(page, count) {
  const selector = '.header .changes-count[data-change="changed"] b'
  const shown = await page
    .waitForFunction(
      ({ target, expected }) => document.querySelector(target)?.textContent === expected,
      { target: selector, expected: String(count) },
      { timeout: COUNT_TIMEOUT },
    )
    .then(() => true)
    .catch(() => false)

  const said = await page.evaluate(
    (target) => document.querySelector(target)?.textContent ?? null,
    selector,
  )

  const reloaded = (await page.evaluate(() => window.describeMeOpened)) !== true

  return {
    passed: shown && !reloaded,
    detail: `the header says ${said} changed, reloaded ${reloaded}`,
  }
}
