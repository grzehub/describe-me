/**
 * Checks the built site/ in headless Chromium, served over HTTP as a host
 * would serve it: docs.css applies to the pages (the light `--bg` token is the
 * body background), and each example viewer loads its data and shows as many
 * tests as its manifest has tests with a frame besides the closing one. Then
 * Live, which `pnpm site:build` builds into both viewers: `__live.json` says
 * `ready` with the base `__live/`, and `L` mounts a test in a live frame
 * without a sandbox, on the site's own origin. In react-browser a click on
 * Actions, then Rename, in the frame shows `onSelect("Rename")` in the
 * inspector. In react-browser the tag `forms` shows on its tests, the search
 * finds them by it, `#tag=forms` and a click on the tag in the inspector narrow
 * the sidebar to them, and × shows every test again. No request to the site
 * may fail and the page may throw no error.
 * Remote requests are answered locally, so remote fonts never decide the
 * result. Run after `pnpm site:build`.
 *
 * Usage: `node scripts/check-site.mjs`
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleNames } from './docs/example-names.mjs'
import { launchChromium } from './docs/launch-chromium.mjs'
import { repoRoot } from './docs/repo-root.mjs'
import { serveStatic } from './docs/serve-static.mjs'
import { shownTests } from './docs/shown-tests.mjs'

const SITE = join(repoRoot, 'site')
// --bg of the light :root block in docs/docs.css.
const LIGHT_BACKGROUND = 'rgb(245, 246, 248)'
const VIEWER_TIMEOUT = 20_000
const LIVE_TIMEOUT = 30_000
const LIVE_READY = JSON.stringify({ status: 'ready', base: '__live/' })
// `mounted` in packages/viewer/src/live-status-words.ts.
const MOUNTED_WORDS = 'mounted as the test arranged it'

async function selectsRename(page) {
  const frame = page.frameLocator('.stage-slot.live-slot iframe')

  await frame.getByRole('button', { name: 'Actions' }).click()
  await frame.getByRole('menuitem', { name: 'Rename' }).click()
  await page
    .locator('.live-actions li', { hasText: 'onSelect("Rename")' })
    .waitFor({ state: 'visible', timeout: 5_000 })

  return ', and Rename shows onSelect("Rename") in the inspector'
}

/** The test each viewer mounts in Live, and what to do in it once mounted. */
const LIVE_TESTS = {
  'react-browser': { fullName: 'Menu > selects an item and reports it', act: selectsRename },
  'react-jsdom': { fullName: 'Heading > takes its colour from the theme' },
}

/** The example whose tests carry a tag of the project's own, and that tag. */
const TAGGED = { name: 'react-browser', tag: 'forms' }

function errorMessage(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error)
}

async function checkPages(context, url) {
  const page = await context.newPage()

  try {
    await page.goto(`${url}index.html`)

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    if (background !== LIGHT_BACKGROUND) {
      return [
        `index.html: the body background is ${background}, not ${LIGHT_BACKGROUND}. Is docs.css served?`,
      ]
    }

    return []
  } finally {
    await page.close()
  }
}

/** The expected test count from the manifest the viewer itself loads. */
function expectedCount(name) {
  const path = join(SITE, 'examples', name, '__data', 'manifest.json')

  if (!existsSync(path)) {
    return null
  }

  return shownTests(JSON.parse(readFileSync(path, 'utf8'))).length
}

async function checkViewer(context, url, name) {
  const expected = expectedCount(name)

  if (expected === null) {
    return [
      `examples/${name}/: site/examples/${name}/__data/manifest.json is missing. Run pnpm site:build`,
    ]
  }

  const page = await context.newPage()
  const failures = []

  page.on('pageerror', (error) => failures.push(errorMessage(error)))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} for ${response.url().slice(url.length)}`)
    }
  })

  try {
    await page.goto(`${url}examples/${name}/`)

    // Without data the header still renders, with 0 tests and "…" as the time of the run.
    const loaded = await page
      .waitForFunction(
        () => {
          const when = document.querySelector('header.header .live .mono')

          return when !== null && when.textContent !== '…'
        },
        undefined,
        { timeout: VIEWER_TIMEOUT },
      )
      .then(() => true)
      .catch(() => false)

    const shown = await page.evaluate(
      () => document.querySelector('header.header .stat b')?.textContent ?? null,
    )

    const detail = failures.length > 0 ? ` (${failures.join(', ')})` : ''

    if (!loaded) {
      return [
        `examples/${name}/: the viewer did not load its data within ${VIEWER_TIMEOUT / 1000} s${detail}`,
      ]
    }

    if (shown !== String(expected)) {
      return [
        `examples/${name}/: the viewer shows ${shown ?? 'no'} tests, the manifest has ${expected}${detail}`,
      ]
    }

    console.log(`check-site: examples/${name}/ shows ${expected} tests`)

    return []
  } finally {
    await page.close()
  }
}

async function rowCount(page) {
  return page.locator('.tree .test').count()
}

/** Whether the sidebar settles on `count` rows. The viewer repaints after the event that changed it. */
async function showsRows(page, count) {
  return page
    .waitForFunction((rows) => document.querySelectorAll('.tree .test').length === rows, count, {
      timeout: 5_000,
    })
    .then(() => true)
    .catch(() => false)
}

/** The steps of the tag check, each returning a problem or `null`. */
async function tagSteps(page, url, tagged, total) {
  const { name, tag } = TAGGED
  const rows = page.locator('.tree .test', {
    has: page.locator('.test-tags .tag', { hasText: tag }),
  })

  if ((await rows.count()) !== tagged) {
    return `${await rows.count()} rows show the tag ${tag}, the manifest has ${tagged}`
  }

  await page.locator('.sidebar-search').fill(tag)

  if (!(await showsRows(page, tagged))) {
    return `searching "${tag}" shows ${await rowCount(page)} tests, expected ${tagged}`
  }

  await page.locator('.sidebar-search').fill('')

  // Without the wait the debounced search would still narrow the list below.
  if (!(await showsRows(page, total))) {
    return `clearing the search shows ${await rowCount(page)} tests, expected ${total}`
  }

  await page.goto(`${url}examples/${name}/#tag=${tag}`)
  await page.locator('.tag-filter').waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  if (!(await showsRows(page, tagged))) {
    return `#tag=${tag} shows ${await rowCount(page)} tests, expected ${tagged}`
  }

  await page.locator('.tag-filter-clear').click()

  if (!(await showsRows(page, total)) || page.url().includes('tag=')) {
    return `× left ${await rowCount(page)} tests and the link ${page.url().slice(url.length)}`
  }

  await rows.first().click()
  await page.locator('.inspector .tags button.tag', { hasText: tag }).click()

  if (!(await showsRows(page, tagged)) || !page.url().includes(`tag=${tag}`)) {
    return `the tag in the inspector shows ${await rowCount(page)} tests, link ${page.url().slice(url.length)}`
  }

  return null
}

async function checkTags(context, url) {
  const { name, tag } = TAGGED
  const manifest = readSiteManifest(name)
  const shown = shownTests(manifest)
  const tagged = shown.filter((test) => test.tags?.includes(tag)).length

  if (tagged === 0) {
    return [`examples/${name}/: no test of the manifest is tagged ${tag}`]
  }

  const page = await context.newPage()
  const failures = []

  page.on('pageerror', (error) => failures.push(errorMessage(error)))

  try {
    await page.goto(`${url}examples/${name}/`)
    await page.locator('.tree .test').first().waitFor({ timeout: VIEWER_TIMEOUT })

    const problem = await tagSteps(page, url, tagged, shown.length)
    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `examples/${name}/ tags: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ shows and filters by the tag ${tag} (${tagged} tests)`,
    )

    return []
  } finally {
    await page.close()
  }
}

function readSiteManifest(name) {
  return JSON.parse(readFileSync(join(SITE, 'examples', name, '__data', 'manifest.json'), 'utf8'))
}

function testIdOf(name, fullName) {
  const test = readSiteManifest(name)
    .modules.flatMap((module) => module.tests)
    .find((candidate) => candidate.fullName === fullName)

  if (!test) {
    throw new Error(`the manifest has no test "${fullName}"`)
  }

  return test.id
}

/** A page that answers remote requests locally and keeps failed site requests and page errors. */
async function openLivePage(browser, url) {
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: { width: 1280, height: 800 },
  })

  await context.route(
    (target) => target.protocol === 'https:',
    (route) => {
      const type = route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/plain'

      return route.fulfill({ status: 200, contentType: type, body: '' })
    },
  )

  const page = await context.newPage()
  const failures = []
  const siteOrigin = new URL(url).origin

  page.on('pageerror', (error) => failures.push(`page error: ${errorMessage(error)}`))
  page.on('response', (response) => {
    const target = new URL(response.url())

    if (target.origin === siteOrigin && response.status() >= 400) {
      failures.push(`${response.status()} for ${target.pathname}`)
    }
  })

  return { context, page, failures }
}

/** The live slot's iframe: no sandbox, and `live.html` of the viewer's `__live/` as its source. */
async function checkLiveIframe(page, expected) {
  const iframe = page.locator('.stage-slot.live-slot iframe')

  await iframe.waitFor({ state: 'attached', timeout: 5_000 })

  const sandbox = await iframe.getAttribute('sandbox')
  const src = new URL(await iframe.getAttribute('src'))
  const problems = []

  src.search = ''

  if (sandbox !== null) {
    problems.push(`the live iframe has sandbox="${sandbox}"`)
  }

  if (src.href !== expected) {
    problems.push(`the live iframe loads ${src.href}, expected ${expected}`)
  }

  return problems
}

async function mountLive(page, url, name) {
  const { fullName, act } = LIVE_TESTS[name]

  await page.goto(`${url}examples/${name}/#test=${testIdOf(name, fullName)}`)
  await page
    .locator('.live-toggle:not([aria-disabled])')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await page.keyboard.press('l')

  const problems = await checkLiveIframe(page, `${url}examples/${name}/__live/live.html`)

  if (problems.length > 0) {
    return { problems }
  }

  await page
    .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
    .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

  return { problems: [], shown: act === undefined ? '' : await act(page) }
}

/** Live in the viewer of the site: `__live.json`, then one test mounted through `L`. */
async function checkLive(browser, url, name) {
  const label = `examples/${name}/ Live`
  const liveJson = join(SITE, 'examples', name, '__live.json')
  const said = existsSync(liveJson) ? readFileSync(liveJson, 'utf8') : 'nothing'

  if (said !== LIVE_READY) {
    return [`${label}: __live.json says ${said}, expected ${LIVE_READY}. Run pnpm site:build`]
  }

  const { context, page, failures } = await openLivePage(browser, url)

  try {
    const mounted = await mountLive(page, url, name)
    const problems = [...mounted.problems, ...failures]

    if (problems.length > 0) {
      return problems.map((problem) => `${label}: ${problem}`)
    }

    console.log(
      `check-site: examples/${name}/ mounts ${LIVE_TESTS[name].fullName} in Live, on the site's origin without a sandbox${mounted.shown}`,
    )

    return []
  } catch (error) {
    const shown = await page
      .locator('.live-section')
      .innerText({ timeout: 1_000 })
      .catch(() => 'no live section')

    return [`${label}: ${errorMessage(error)} (${[shown, ...failures].join(', ')})`]
  } finally {
    await context.close()
  }
}

const missing = [
  'index.html',
  ...exampleNames.map((name) => join('examples', name, 'index.html')),
].filter((file) => !existsSync(join(SITE, file)))

if (missing.length > 0) {
  console.error(`check-site: site/ lacks ${missing.join(', ')}. Run pnpm site:build first`)
  process.exit(1)
}

const { server, url } = await serveStatic(SITE)
let browser = null
let problems = []

try {
  browser = await launchChromium()

  const context = await browser.newContext({ colorScheme: 'light' })

  problems.push(...(await checkPages(context, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkViewer(context, url, name)))
  }

  problems.push(...(await checkTags(context, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkLive(browser, url, name)))
  }
} catch (error) {
  problems = [...problems, errorMessage(error)]
} finally {
  await browser?.close()
  server.closeAllConnections()
  server.close()
}

for (const problem of problems) {
  console.error(`check-site: ${problem}`)
}

if (problems.length > 0) {
  process.exit(1)
}

console.log(
  `check-site: ok — docs.css applies, ${exampleNames.length} viewers load their tests, filter by a tag and mount one in Live`,
)
