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
 * the sidebar to them, `#tag=forms` alone opens one of them, and × shows every
 * test again. In both viewers `bg` and the background switch set the stage's
 * canvas and the frame's color scheme, in a replayed frame, in Live and in the
 * overview's thumbnails, and no frame paints an opaque backdrop. With the live
 * page held back, the dimmed recorded frame stays under the live frame until
 * the first status and fades out after, leaving Live or picking another test
 * while it loads leaves one slot, and reduced motion keeps only the dimmed
 * frame. The sidebar's edge sets its width with ← → and by dragging, a
 * double-click sets it back, frames ignore the pointer during a drag and the
 * stage refits after it, and each viewer keeps its own width after a reload.
 * The viewer's theme switch sets the chrome's colors and survives a reload,
 * the stored theme is set before `<body>`, a repaint keeps a focused theme
 * button focused, the switch works without storage until a reload, and no
 * theme changes a frame's pixels, canvas, color scheme or media query, in
 * replay and in Live. With the react-browser manifest padded in memory, a long
 * props table folds in the overview and in the inspector, and stays unfolded
 * through a frame step and a visit to another test until the page reloads. No
 * request to the site may fail and the page may throw no error. Remote
 * requests are answered locally, so remote fonts never decide the result. Run
 * after `pnpm site:build`.
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
// --bg of the light :root block in docs/docs.css, which tokens.mjs keeps equal to the viewer's.
const LIGHT_BACKGROUND = 'rgb(245, 246, 248)'
// --bg of the dark blocks in packages/viewer/src/style.css.
const DARK_BACKGROUND = 'rgb(17, 19, 22)'
const VIEWER_TIMEOUT = 20_000
const LIVE_TIMEOUT = 30_000
const LIVE_READY = JSON.stringify({ status: 'ready', base: '__live/' })
// `mounted` and `loading` in packages/viewer/src/live-status-words.ts.
const MOUNTED_WORDS = 'mounted as the test arranged it'
const LOADING_WORDS = 'mounting…'
// --canvas-light and --canvas-dark in packages/viewer/src/style.css.
const LIGHT_CANVAS = 'rgb(255, 255, 255)'
const DARK_CANVAS = 'rgb(20, 22, 25)'
const BACKGROUNDS = ['auto', 'light', 'dark', 'transparent']
// Both examples paint their page white, so `auto` is light in both. The checkerboard is an image.
const CANVASES = {
  auto: { canvas: LIGHT_CANVAS, image: false },
  light: { canvas: LIGHT_CANVAS, image: false },
  dark: { canvas: DARK_CANVAS, image: false },
  transparent: { image: true },
}

// SidebarWidth in packages/viewer/src/sidebar-width.ts, and the most at the 1280 px of openLivePage().
const SIDEBAR = { default: 296, min: 216, step: 16, max: 640 }
const SIDEBAR_TIMEOUT = 5_000
const RECORDED_IFRAME = '.stage-slot[data-frame]:not(.incoming) iframe'
const LIVE_IFRAME = '.stage-slot.live-slot iframe'
// The page paints nothing, so only a backdrop under it can differ from the bare canvas.
const SEE_THROUGH =
  '<style>html, body { background: transparent !important; overflow: hidden !important } body * { visibility: hidden !important }</style>'

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

/** The react-browser Button and two of its tests, padded in memory to more props than any example has. */
const LONG_PROPS = {
  name: 'react-browser',
  component: 'Button',
  suite: 'src/Button.test.tsx::Button',
  padded: { fullName: 'Button > sizes > renders small and large', props: 20 },
  short: { fullName: 'Button > variants > renders secondary', props: 12 },
  componentProps: 13,
}

// SHOWN_ROWS in packages/viewer/src/collapse-props.ts.
const SHOWN_ROWS = 10

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

  const opened = page.locator('.tree .test.active', {
    has: page.locator('.test-tags .tag', { hasText: tag }),
  })

  // A link with only a tag opens one of the tests the filtered list shows.
  if ((await opened.count()) !== 1) {
    return `#tag=${tag} opens a test the filtered list does not show`
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

/** `props` with `extraN: 'value'` keys until it has `count` of them. */
function padProps(props, count) {
  for (let index = 1; Object.keys(props).length < count; index++) {
    props[`extra${index}`] = 'value'
  }
}

function padManifest(manifest, ids) {
  const { component, padded, short, componentProps } = LONG_PROPS
  const doc = manifest.components[component]

  for (let index = 1; doc.props.length < componentProps; index++) {
    doc.props.push({ name: `extra${index}`, type: 'string', required: false, kind: 'string' })
  }

  const counts = { [ids.padded]: padded.props, [ids.short]: short.props }

  for (const test of manifest.modules.flatMap((module) => module.tests)) {
    const count = counts[test.id]

    if (count === undefined) {
      continue
    }

    padProps(test.component.props, count)

    for (const frame of test.frames) {
      if (frame.meta?.props) {
        padProps(frame.meta.props, count)
      }
    }
  }
}

/** Whether `selector` settles on `count` matches. The viewer repaints after the event that changed it. */
async function settlesOn(page, selector, count) {
  return page
    .waitForFunction(
      ([target, rows]) => document.querySelectorAll(target).length === rows,
      [selector, count],
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false)
}

/** A problem when the table in `where` does not show `count` rows and a button reading `label`, or no button for `null`. */
async function foldProblem(page, where, count, label, expanded) {
  const rows = `${where.table} tr:not([hidden])${where.cells}`
  const settled = await settlesOn(page, rows, count)
  const button = page.locator(`${where.scope} .props-more`)
  const shown = await page.locator(rows).count()

  if (label === null) {
    const buttons = await button.count()

    return settled && buttons === 0
      ? null
      : `${where.label} shows ${shown} rows and ${buttons} buttons, expected ${count} and none`
  }

  const text = await button.textContent({ timeout: 5_000 }).catch(() => null)
  const aria = await button.getAttribute('aria-expanded', { timeout: 5_000 }).catch(() => null)

  if (!settled || text !== label || aria !== String(expanded)) {
    return `${where.label} shows ${shown} rows, "${text}" and aria-expanded=${aria}, expected ${count}, "${label}" and ${expanded}`
  }

  return null
}

const OVERVIEW = {
  label: 'the overview',
  scope: '.overview',
  table: '.overview table.props',
  cells: ':has(td)',
}

const INSPECTOR = {
  label: 'the inspector',
  scope: '.inspector',
  table: '.inspector table.kv',
  cells: '',
}

/** Enter on the focused button unfolds and folds the overview, and focus stays on it. */
async function overviewKeySteps(page, more) {
  const button = page.locator('.overview .props-more')

  await button.focus()
  await page.keyboard.press('Enter')

  const unfolded = await foldProblem(page, OVERVIEW, LONG_PROPS.componentProps, 'Show fewer', true)

  if (unfolded) {
    return `after Enter, ${unfolded}`
  }

  if (!(await button.evaluate((node) => node === document.activeElement))) {
    return 'Enter on the button moved the focus away from it'
  }

  await page.keyboard.press('Enter')

  const folded = await foldProblem(page, OVERVIEW, SHOWN_ROWS, more, false)

  if (folded) {
    return `after a second Enter, ${folded}`
  }

  await page.keyboard.press('Enter')

  return null
}

/** The first cells of the inspector's visible rows, against the first keys of frame 1. */
async function inspectorOrderProblem(page, keys) {
  const names = await page
    .locator(`${INSPECTOR.table} tr:not([hidden]) td:first-child`)
    .allTextContents()

  const expected = keys.slice(0, SHOWN_ROWS)

  return names.join() === expected.join()
    ? null
    : `the inspector shows ${names.join(', ')}, expected ${expected.join(', ')}`
}

/** The steps of the long props check, each returning a problem or `null`. */
async function longPropsSteps(page, base, ids, keys) {
  const { suite, padded, short, componentProps } = LONG_PROPS
  const more = `Show ${componentProps - SHOWN_ROWS} more`
  const suiteUrl = `${base}#suite=${encodeURIComponent(suite)}`

  await page.goto(suiteUrl)

  const steps = [
    () => foldProblem(page, OVERVIEW, SHOWN_ROWS, more, false),
    () => overviewKeySteps(page, more),
    async () => {
      await page.goto(`${base}#test=${ids.padded}`)

      return (
        (await foldProblem(
          page,
          INSPECTOR,
          SHOWN_ROWS,
          `Show ${padded.props - SHOWN_ROWS} more`,
          false,
        )) ?? (await inspectorOrderProblem(page, keys))
      )
    },
    async () => {
      await page.locator('.inspector .props-more').click()

      return foldProblem(page, INSPECTOR, padded.props, 'Show fewer', true)
    },
    async () => {
      await page.keyboard.press('ArrowRight')
      await page.locator('.inspector h3', { hasText: 'frame 2 / 2' }).waitFor({ timeout: 5_000 })

      return foldProblem(page, INSPECTOR, padded.props, 'Show fewer', true)
    },
    async () => {
      await page.goto(`${base}#test=${ids.short}`)

      return foldProblem(page, INSPECTOR, short.props, null)
    },
    async () => {
      await page.goto(`${base}#test=${ids.padded}`)

      return foldProblem(page, INSPECTOR, padded.props, 'Show fewer', true)
    },
    async () => {
      await page.goto(suiteUrl)

      return foldProblem(page, OVERVIEW, componentProps, 'Show fewer', true)
    },
    async () => {
      await page.reload()

      return foldProblem(page, OVERVIEW, SHOWN_ROWS, more, false)
    },
  ]

  for (const [index, step] of steps.entries()) {
    const problem = await step()

    if (problem) {
      return `step ${index + 1}: ${problem}`
    }
  }

  return null
}

async function checkLongProps(context, url) {
  const { name, component, padded, short, componentProps } = LONG_PROPS
  const manifest = readSiteManifest(name)
  const own = manifest.components?.[component]?.props.length

  if (own === undefined || own >= componentProps) {
    return [
      `examples/${name}/ long props: ${component} has ${own ?? 'no'} props in the manifest, expected fewer than ${componentProps}`,
    ]
  }

  const ids = { padded: testIdOf(name, padded.fullName), short: testIdOf(name, short.fullName) }

  padManifest(manifest, ids)

  const keys = Object.keys(
    manifest.modules.flatMap((module) => module.tests).find((test) => test.id === ids.padded)
      .frames[0].meta.props,
  )

  const page = await context.newPage()
  const failures = []

  page.on('pageerror', (error) => failures.push(errorMessage(error)))

  // Only this page sees the padded manifest. The other scenarios share the context.
  await page.route(`**/examples/${name}/__data/manifest.json`, async (route) => {
    const response = await route.fetch()
    const json = await response.json()

    padManifest(json, ids)

    return route.fulfill({ response, json })
  })

  try {
    const problem = await longPropsSteps(page, `${url}examples/${name}/`, ids, keys)
    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `examples/${name}/ long props: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ folds long props tables (${SHOWN_ROWS} of ${componentProps} in the overview, ${SHOWN_ROWS} of ${padded.props} in the inspector, ${short.props} in full)`,
    )

    return []
  } finally {
    await page.close()
  }
}

/**
 * A page that answers remote requests locally and keeps failed site requests
 * and page errors. `colorScheme: null` turns the emulation off, and
 * `reducedMotion` sets `prefers-reduced-motion`.
 */
async function openLivePage(browser, url, colorScheme = 'light', reducedMotion = 'no-preference') {
  const context = await browser.newContext({
    colorScheme,
    reducedMotion,
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

/**
 * What the stage and the frame at `selector` show, read in the page. With
 * `expected`, whether they show it, for `waitForFunction()`.
 */
function stageBackground({ selector, expected }) {
  const stage = getComputedStyle(document.querySelector('.stage'))
  const iframe = document.querySelector(selector)
  const pressed = document.querySelectorAll('.backgrounds [aria-pressed="true"]')
  const seen = {
    canvas: stage.backgroundColor,
    image: stage.backgroundImage !== 'none',
    scheme: iframe ? getComputedStyle(iframe).colorScheme : 'no frame',
    dark: iframe?.contentWindow?.matchMedia('(prefers-color-scheme: dark)').matches ?? null,
    pressed: Array.from(pressed, (button) => button.getAttribute('aria-label')).join(' '),
  }

  if (expected === undefined) {
    return seen
  }

  return Object.entries(expected).every(([key, value]) => seen[key] === value)
}

/** Waits until the stage and the frame at `selector` show `value`. Returns a problem or `null`. */
async function showsBackground(page, selector, value) {
  const expected = {
    ...CANVASES[value],
    scheme: value === 'dark' ? 'dark' : 'light',
    dark: value === 'dark',
    pressed: value,
  }

  const shown = await page
    .waitForFunction(stageBackground, { selector, expected }, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (shown) {
    return null
  }

  const seen = await page.evaluate(stageBackground, { selector })

  return `with ${value} the stage and frame show ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`
}

async function pickBackground(page, value) {
  await page
    .getByRole('group', { name: 'Stage background' })
    .getByRole('button', { name: value, exact: true })
    .click()
}

function linkBackground(page) {
  return new URLSearchParams(new URL(page.url()).hash.slice(1)).get('bg')
}

async function seeThrough(page, selector) {
  await page
    .locator(selector)
    .evaluate(
      (iframe, style) => iframe.contentDocument.head.insertAdjacentHTML('beforeend', style),
      SEE_THROUGH,
    )
}

/**
 * Whether the see-through frame at `selector` changes a pixel of its slot.
 * Its page paints nothing, so only Chromium's opaque backdrop can.
 */
async function paintsBackdrop(page, selector) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )

  const iframe = page.locator(selector)
  const clip = await iframe.locator('xpath=..').boundingBox()
  const shown = await page.screenshot({ clip })

  await iframe.evaluate((element) => {
    element.style.visibility = 'hidden'
  })

  const hidden = await page.screenshot({ clip })

  await iframe.evaluate((element) => {
    element.style.visibility = ''
  })

  return !shown.equals(hidden)
}

/** Each value of the switch on the frame at `selector`: canvas, scheme, media query and no backdrop. */
async function eachBackground(page, selector, check = async () => null) {
  for (const value of BACKGROUNDS) {
    await pickBackground(page, value)

    const problem = (await showsBackground(page, selector, value)) ?? (await check(value))

    if (problem) {
      return problem
    }

    if (await paintsBackdrop(page, selector)) {
      return `with ${value} the frame paints a backdrop over the canvas`
    }
  }

  return null
}

/** `bg=dark` in the link, then the switch, in a replayed frame. */
async function replaySteps(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}&bg=dark`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const linked = await showsBackground(page, RECORDED_IFRAME, 'dark')

  if (linked) {
    return `#bg=dark: ${linked}`
  }

  for (const [value, expected] of [
    ['light', 'light'],
    ['transparent', 'transparent'],
    ['auto', null],
  ]) {
    await pickBackground(page, value)

    const problem = await showsBackground(page, RECORDED_IFRAME, value)

    if (problem) {
      return problem
    }

    const linked = linkBackground(page)

    if (linked !== expected) {
      return `with ${value} the link has bg=${linked}, expected ${expected}`
    }
  }

  await seeThrough(page, RECORDED_IFRAME)

  return eachBackground(page, RECORDED_IFRAME)
}

/** Waits until the live frame has faded in and the recorded frame under it is gone. */
async function faded(page) {
  await page.locator('.stage-slot.live-underlay').waitFor({ state: 'detached', timeout: 5_000 })
  await page
    .locator('.stage-slot.live-slot:not(.loading)')
    .waitFor({ state: 'attached', timeout: 5_000 })

  await page.waitForFunction(
    (selector) => getComputedStyle(document.querySelector(selector)).opacity === '1',
    LIVE_IFRAME,
    { timeout: 5_000 },
  )
}

/** The switch in Live, which must not reload the live frame. */
async function liveSteps(page) {
  await page
    .locator('.live-toggle:not([aria-disabled])')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await page.keyboard.press('l')
  await page
    .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
    .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

  // Until the fade ends, the recorded frame under the live one changes the stage's pixels.
  await faded(page)
  await page.locator(LIVE_IFRAME).evaluate((iframe) => {
    iframe.contentWindow.stageBackgroundMarker = true
  })

  await seeThrough(page, LIVE_IFRAME)

  const problem = await eachBackground(page, LIVE_IFRAME, async (value) => {
    const kept = await page
      .locator(LIVE_IFRAME)
      .evaluate((iframe) => iframe.contentWindow.stageBackgroundMarker === true)

    return kept ? null : `with ${value} the live frame reloaded`
  })

  if (problem) {
    return `Live: ${problem}`
  }

  const label = await page
    .locator('.stage-slot.live-slot')
    .evaluate((slot) => getComputedStyle(slot, '::before').content)

  return label.includes('Live') ? null : `the live slot's label has the content ${label}`
}

/** `bg=dark` in the link of an overview: the first thumbnail's canvas, scheme and media query. */
async function overviewSteps(page, url, name, id) {
  const moduleId = readSiteManifest(name).modules.find((candidate) =>
    candidate.tests.some((test) => test.id === id),
  ).id

  await page.goto(`${url}examples/${name}/#suite=${encodeURIComponent(moduleId)}&bg=dark`)

  const iframe = page.locator('.thumb iframe').first()

  await iframe.waitFor({ state: 'attached', timeout: VIEWER_TIMEOUT })

  const dark = await page
    .waitForFunction(
      () => getComputedStyle(document.querySelector('.thumb iframe')).colorScheme === 'dark',
      undefined,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false)

  const seen = await iframe.evaluate((element) => ({
    media: element.contentWindow.matchMedia('(prefers-color-scheme: dark)').matches,
    canvas: getComputedStyle(element.closest('.thumb')).backgroundColor,
  }))

  if (!dark || !seen.media || seen.canvas !== DARK_CANVAS) {
    return `the first thumbnail of #suite=…&bg=dark shows ${JSON.stringify({ dark, ...seen })}`
  }

  return null
}

/** The stage background: `bg` in the link, the switch, Live and the overview. */
async function checkStageBackground(browser, url, name) {
  const label = `examples/${name}/ stage background`
  // Emulating a scheme forces `prefers-color-scheme` in every frame and hides
  // the one each frame takes from its iframe, so the emulation is off here.
  const { context, page, failures } = await openLivePage(browser, url, null)
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    const problem =
      (await replaySteps(page, url, name, id)) ??
      (await liveSteps(page)) ??
      (await overviewSteps(page, url, name, id))

    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ bg sets the canvas and the frames' color scheme, in replay, in Live and in the overview, with no backdrop`,
    )

    return []
  } catch (error) {
    return [`${label}: ${[errorMessage(error), ...failures].join(', ')}`]
  } finally {
    await context.close()
  }
}

/**
 * Holds every request for `live.html` until `release()`, so a live frame stays
 * loading. `continue()` throws once the route is gone or the frame was
 * removed, and the request goes through anyway.
 */
async function holdLivePage(page) {
  let open = () => {}
  let released = null
  const gate = new Promise((resolve) => {
    open = resolve
  })

  const held = []
  const matcher = (target) => target.pathname.endsWith('/live.html')
  const handler = (route) => {
    const continued = gate.then(() => route.continue()).catch(() => {})

    held.push(continued)

    return continued
  }

  await page.route(matcher, handler)

  return () => {
    released ??= (async () => {
      open()
      await Promise.all(held)
      await page.unroute(matcher, handler)
    })()

    return released
  }
}

/**
 * Live's loading state, read in the page, `id` being the test first shown.
 * With `expected`, whether the page shows it, for `waitForFunction()`.
 */
function liveLoading({ id, expected }) {
  const styleOf = (element) => (element ? getComputedStyle(element) : null)
  const frames = document.querySelector('.stage-frames')
  const live = document.querySelector('.stage-slot.live-slot')
  const underlay = document.querySelector('.stage-slot.live-underlay')
  const slot = styleOf(live)
  const iframe = styleOf(live?.querySelector('iframe'))
  const underlayOpacity = Number(styleOf(underlay?.querySelector('iframe'))?.opacity ?? 'NaN')
  const dot = getComputedStyle(document.querySelector('.live-toggle'), '::before')
  const seen = {
    live: document.querySelectorAll('.stage-slot.live-slot').length,
    loading: document.querySelectorAll('.stage-slot.live-slot.loading').length,
    liveOfTest: live?.dataset.test === id,
    liveOpacity: iframe?.opacity ?? null,
    liveTransition: iframe?.transitionProperty ?? null,
    liveDuration: iframe?.transitionDuration ?? null,
    shimmer: slot ? slot.animationName !== 'none' : null,
    shimmerImage: slot ? slot.backgroundImage !== 'none' : null,
    underlays: document.querySelectorAll('.stage-slot.live-underlay').length,
    underlayOfTest: underlay?.dataset.test === id,
    underlayDimmed: underlayOpacity > 0 && underlayOpacity < 1,
    recorded: document.querySelectorAll('.stage-slot[data-frame]:not(.incoming) iframe').length,
    slots: frames.querySelectorAll(':scope > .stage-slot').length,
    onlyRecorded:
      frames.children.length === 1 &&
      frames.children[0].matches('.stage-slot[data-frame]:not(.incoming)'),
    toggle: document.querySelector('.live-toggle.loading') !== null,
    pulse: dot.animationName !== 'none',
    dotDim: Number(dot.opacity) < 1,
    status: document.querySelector('.live-section .live-status')?.textContent.trim() ?? null,
  }

  if (expected === undefined) {
    return seen
  }

  return Object.entries(expected).every(([key, value]) => seen[key] === value)
}

/** What the page shows that `expected` does not, for a problem's message. */
async function loadingMismatch(page, id, expected) {
  const seen = await page.evaluate(liveLoading, { id })
  const differs = Object.keys(expected).filter((key) => seen[key] !== expected[key])

  return differs.map((key) => `${key} is ${JSON.stringify(seen[key])}`).join(', ')
}

/** Waits until the stage shows `expected`. Returns a problem or `null`. */
async function showsLoading(page, id, expected, timeout) {
  const shown = await page
    .waitForFunction(liveLoading, { id, expected }, { timeout })
    .then(() => true)
    .catch(() => false)

  return shown ? null : loadingMismatch(page, id, expected)
}

/** Whether the stage still shows `expected`, read once. Returns a problem or `null`. */
async function stillShowsLoading(page, id, expected) {
  const shown = await page.evaluate(liveLoading, { id, expected })

  return shown ? null : loadingMismatch(page, id, expected)
}

/** What the stage shows while a new live frame of the test loads over its recorded frame. */
function loadingOverRecorded() {
  return {
    loading: 1,
    liveOfTest: true,
    liveOpacity: '0',
    liveTransition: 'opacity',
    liveDuration: '0.15s',
    shimmer: true,
    underlays: 1,
    underlayOfTest: true,
    underlayDimmed: true,
    recorded: 0,
    toggle: true,
    pulse: true,
    status: LOADING_WORDS,
  }
}

/** The test's recorded frame on the stage, with Live ready to start. */
async function showRecorded(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}`)
  await page.locator(RECORDED_IFRAME).waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })
  await page
    .locator('.live-toggle:not([aria-disabled])')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })
}

/** Records in the page when the underlay gets `leaving` and when it leaves the stage. */
function watchUnderlay() {
  const frames = document.querySelector('.stage-frames')
  const underlay = frames.querySelector(':scope > .live-underlay')
  const seen = { leaving: null, removed: null }
  const observer = new MutationObserver(() => {
    if (seen.leaving === null && underlay.classList.contains('leaving')) {
      seen.leaving = performance.now()
    }

    if (seen.removed === null && underlay.parentElement !== frames) {
      seen.removed = performance.now()
      observer.disconnect()
    }
  })

  window.liveUnderlaySeen = seen
  observer.observe(frames, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  })
}

/** Until the first status the dimmed recorded frame stays, then it fades out and leaves. */
async function loadingSteps(page, id, release) {
  await page.keyboard.press('l')

  const loading = loadingOverRecorded()
  const shown = await showsLoading(page, id, loading, 5_000)

  if (shown) {
    return `while it loads: ${shown}`
  }

  await page.waitForTimeout(500)

  const kept = await stillShowsLoading(page, id, loading)

  if (kept) {
    return `500 ms later, still held: ${kept}`
  }

  await page.evaluate(watchUnderlay)
  await release()
  await page
    .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
    .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

  const settled = await showsLoading(
    page,
    id,
    { underlays: 0, live: 1, loading: 0, slots: 1, liveOpacity: '1', toggle: false },
    2_000,
  )

  if (settled) {
    return `after the first status: ${settled}`
  }

  const { leaving, removed } = await page.evaluate(() => window.liveUnderlaySeen)

  if (leaving === null || removed === null || removed - leaving < 100) {
    return `the underlay got leaving at ${leaving} ms and left at ${removed} ms, expected 100 ms or more between`
  }

  return null
}

/** `L` leaves Live once it mounted, and the recorded frame comes back. */
async function leaveLive(page) {
  await page.keyboard.press('l')
  await page.locator(RECORDED_IFRAME).waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  return null
}

/** `L` again while Live loads: the swap leaves the recorded frame alone on the stage. */
async function leaveWhileLoading(page, id, release) {
  await page.keyboard.press('l')
  await page.locator('.stage-slot.live-underlay').waitFor({ state: 'attached', timeout: 5_000 })
  await page.keyboard.press('l')

  const left = await showsLoading(
    page,
    id,
    { onlyRecorded: true, live: 0, underlays: 0, toggle: false },
    5_000,
  )

  await release()

  return left ? `leaving Live while it loads: ${left}` : null
}

/** Another test while Live loads: no underlay, and the shimmer runs on the empty canvas. */
async function otherTestWhileLoading(page, id, release) {
  await page.keyboard.press('l')
  await page.locator('.stage-slot.live-underlay').waitFor({ state: 'attached', timeout: 5_000 })
  await page.locator('.tree .test:not(.active)').first().click()

  const picked = await showsLoading(
    page,
    id,
    { underlays: 0, live: 1, loading: 1, liveOfTest: false, shimmerImage: true },
    5_000,
  )

  await release()

  if (picked) {
    return `another test while Live loads: ${picked}`
  }

  await page.waitForFunction(
    (words) => {
      const status = document.querySelector('.live-section .live-status')

      return status !== null && !status.textContent.includes(words)
    },
    LOADING_WORDS,
    { timeout: LIVE_TIMEOUT },
  )

  const ended = await showsLoading(page, id, { live: 1, loading: 0 }, 2_000)

  return ended ? `after the other test's first status: ${ended}` : null
}

/** Runs `step` with `live.html` held, and never leaves a request held behind. */
async function whileHeld(page, step) {
  const release = await holdLivePage(page)

  try {
    return await step(release)
  } finally {
    await release()
  }
}

/** Live's loading state: the dimmed recorded frame until the first status, and one slot after. */
async function checkLiveLoading(browser, url, name) {
  const label = `examples/${name}/ Live loading`
  const { context, page, failures } = await openLivePage(browser, url)
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    await showRecorded(page, url, name, id)

    const problem =
      (await whileHeld(page, (release) => loadingSteps(page, id, release))) ??
      (await leaveLive(page)) ??
      (await whileHeld(page, (release) => leaveWhileLoading(page, id, release))) ??
      (await whileHeld(page, (release) => otherTestWhileLoading(page, id, release)))

    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ keeps the dimmed recorded frame under Live until the first status, fades it out after, and leaving Live or picking another test while it loads leaves one slot`,
    )

    return []
  } catch (error) {
    return [`${label}: ${[errorMessage(error), ...failures].join(', ')}`]
  } finally {
    await context.close()
  }
}

/** With reduced motion, no shimmer, pulse or fade while Live loads, only the dimmed frame. */
async function checkLiveLoadingReducedMotion(browser, url) {
  const name = 'react-browser'
  const label = `examples/${name}/ Live loading with reduced motion`
  const { context, page, failures } = await openLivePage(browser, url, 'light', 'reduce')
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    await showRecorded(page, url, name, id)

    const problem = await whileHeld(page, async (release) => {
      await page.keyboard.press('l')

      const shown = await showsLoading(
        page,
        id,
        {
          loading: 1,
          shimmer: false,
          shimmerImage: false,
          liveDuration: '0s',
          pulse: false,
          dotDim: true,
          underlayDimmed: true,
        },
        5_000,
      )

      await release()
      await page
        .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
        .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

      return shown
    })

    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ with reduced motion shows only the dimmed recorded frame while Live loads`,
    )

    return []
  } catch (error) {
    return [`${label}: ${[errorMessage(error), ...failures].join(', ')}`]
  } finally {
    await context.close()
  }
}

/** Whether the sidebar settles at `width` px, in its box and in the handle, once the tree has rows. */
async function showsWidth(page, width) {
  return page
    .waitForFunction(
      (expected) => {
        const sidebar = document.querySelector('.sidebar')
        const handle = document.querySelector('.sidebar-handle')

        if (document.querySelector('.tree .test') === null || !sidebar || !handle) {
          return false
        }

        const shown = Math.round(sidebar.getBoundingClientRect().width)

        return shown === expected && handle.getAttribute('aria-valuenow') === String(expected)
      },
      width,
      { timeout: SIDEBAR_TIMEOUT },
    )
    .then(() => true)
    .catch(() => false)
}

/** The width the sidebar shows, for a problem's message. */
async function shownWidth(page) {
  return page.evaluate(() => {
    const width = document.querySelector('.sidebar')?.getBoundingClientRect().width
    const now = document.querySelector('.sidebar-handle')?.getAttribute('aria-valuenow')

    return `${width === undefined ? 'no' : Math.round(width)} px (aria-valuenow ${now ?? 'missing'})`
  })
}

/** Whether `localStorage` settles on `value` for `key`. `null` waits for the key to go. */
async function storesWidth(page, key, value) {
  return page
    .waitForFunction(
      ([storageKey, expected]) => localStorage.getItem(storageKey) === expected,
      [key, value],
      { timeout: SIDEBAR_TIMEOUT },
    )
    .then(() => true)
    .catch(() => false)
}

/** Each key press, then the width it should give. */
async function pressesTo(page, keys, width) {
  for (const key of keys) {
    await page.keyboard.press(key)
  }

  if (!(await showsWidth(page, width))) {
    return `${keys.join(' ')} gives ${await shownWidth(page)}, expected ${width} px`
  }

  return null
}

/** A drag from the handle's centre by `distance` px, with `whileDragging` before the release. */
async function dragHandle(page, distance, whileDragging = async () => null) {
  const box = await page.locator('.sidebar-handle').boundingBox()
  const centreX = box.x + box.width / 2
  const centreY = box.y + box.height / 2

  await page.mouse.move(centreX, centreY)
  await page.mouse.down()
  await page.mouse.move(centreX + distance, centreY, { steps: 5 })

  const problem = await whileDragging()

  await page.mouse.up()

  return problem
}

/** Frames ignore the pointer and the stage shows `col-resize` while the edge is dragged. */
async function duringDrag(page) {
  const ignored = await page
    .waitForFunction(
      (selector) => {
        const iframe = document.querySelector(selector)
        const stage = document.querySelector('.stage')

        return (
          iframe !== null &&
          stage !== null &&
          getComputedStyle(iframe).pointerEvents === 'none' &&
          getComputedStyle(stage).cursor === 'col-resize'
        )
      },
      RECORDED_IFRAME,
      { timeout: SIDEBAR_TIMEOUT },
    )
    .then(() => true)
    .catch(() => false)

  return ignored
    ? null
    : 'while dragging, the stage frame takes the pointer or .stage is not col-resize'
}

/** After the drag, the frame takes the pointer again and its slot fills the narrower stage. */
async function afterDrag(page) {
  const settled = await page
    .waitForFunction(
      (selector) => {
        const iframe = document.querySelector(selector)
        const stage = document.querySelector('.stage')

        if (
          iframe === null ||
          stage === null ||
          getComputedStyle(iframe).pointerEvents !== 'auto'
        ) {
          return false
        }

        const padding = getComputedStyle(stage)
        const available =
          stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight)

        return Math.abs(iframe.parentElement.getBoundingClientRect().width - available) <= 1
      },
      RECORDED_IFRAME,
      { timeout: SIDEBAR_TIMEOUT },
    )
    .then(() => true)
    .catch(() => false)

  return settled
    ? null
    : 'after the drag, the stage frame ignores the pointer or its slot did not refit'
}

/** The handle's role and limits at 1280 px, before any change. */
async function handleAttributes(page) {
  const expected = {
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-valuemin': String(SIDEBAR.min),
    'aria-valuemax': String(SIDEBAR.max),
  }

  const handle = page.locator('.sidebar-handle')

  for (const [name, value] of Object.entries(expected)) {
    const actual = await handle.getAttribute(name)

    if (actual !== value) {
      return `the handle has ${name}="${actual}", expected "${value}"`
    }
  }

  return null
}

/** The keyboard part: ← → set the width, ↑ ↓ and both change neither the link nor the focus. */
async function sidebarKeySteps(page, key) {
  const handle = page.locator('.sidebar-handle')

  await handle.focus()

  const before = page.url()
  const problem =
    (await pressesTo(page, ['ArrowRight', 'ArrowRight', 'ArrowRight'], 344)) ??
    (await pressesTo(page, ['ArrowLeft'], 328)) ??
    (await pressesTo(page, ['ArrowUp', 'ArrowDown'], 328))

  if (problem) {
    return problem
  }

  const focused = await handle.evaluate((element) => document.activeElement === element)

  if (page.url() !== before || !focused) {
    return `after the six keys the link is ${page.url()} (was ${before}) and the handle ${focused ? 'has' : 'lost'} focus`
  }

  if (!(await storesWidth(page, key, '328'))) {
    return `localStorage holds ${await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)} for ${key}, expected 328`
  }

  await page.reload()

  return (await showsWidth(page, 328))
    ? null
    : `after a reload the sidebar is ${await shownWidth(page)}, expected 328 px`
}

/** The pointer part: a drag, a double-click, then both limits. */
async function sidebarDragSteps(page, key) {
  const dragged = await dragHandle(page, 100, () => duringDrag(page))

  if (dragged) {
    return dragged
  }

  if (!(await showsWidth(page, 428)) || !(await storesWidth(page, key, '428'))) {
    return `a drag of 100 px gives ${await shownWidth(page)}, expected 428 px, stored too`
  }

  const refit = await afterDrag(page)

  if (refit) {
    return refit
  }

  await page.locator('.sidebar-handle').dblclick()

  if (!(await showsWidth(page, SIDEBAR.default)) || !(await storesWidth(page, key, null))) {
    return `a double-click gives ${await shownWidth(page)}, expected ${SIDEBAR.default} px and no stored width`
  }

  await page.locator('.sidebar-handle').focus()

  const narrowest = await pressesTo(page, Array(10).fill('ArrowLeft'), SIDEBAR.min)

  if (narrowest) {
    return narrowest
  }

  await dragHandle(page, 1000)

  return (await showsWidth(page, SIDEBAR.max))
    ? null
    : `a drag of 1000 px gives ${await shownWidth(page)}, expected ${SIDEBAR.max} px`
}

/** The other viewer starts at the default, because the width belongs to a project. */
async function sidebarOtherProject(page, url) {
  await page.goto(`${url}examples/react-jsdom/`)

  if (!(await showsWidth(page, SIDEBAR.default))) {
    return `examples/react-jsdom/ starts at ${await shownWidth(page)}, expected ${SIDEBAR.default} px`
  }

  await page.locator('.sidebar-handle').focus()

  const wider = SIDEBAR.default + SIDEBAR.step
  const problem = await pressesTo(page, ['ArrowRight'], wider)

  if (problem) {
    return `examples/react-jsdom/: ${problem}`
  }

  await page.reload()

  return (await showsWidth(page, wider))
    ? null
    : `examples/react-jsdom/ after a reload is ${await shownWidth(page)}, expected ${wider} px`
}

/** The sidebar's edge in react-browser, then in react-jsdom, in a context of its own so the widths stay there. */
async function checkSidebarWidth(browser, url) {
  const label = 'sidebar'
  const { context, page, failures } = await openLivePage(browser, url)
  const key = `describe-me:sidebar:${readSiteManifest('react-browser').root}`

  try {
    await page.goto(
      `${url}examples/react-browser/#test=${testIdOf('react-browser', 'Counter > increments')}&frame=1`,
    )

    await page.locator('.tree .test').first().waitFor({ timeout: VIEWER_TIMEOUT })
    await page.locator(RECORDED_IFRAME).waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

    const atStart = (await showsWidth(page, SIDEBAR.default))
      ? await handleAttributes(page)
      : `the sidebar starts at ${await shownWidth(page)}, expected ${SIDEBAR.default} px`

    const problem =
      atStart ??
      (await sidebarKeySteps(page, key)) ??
      (await sidebarDragSteps(page, key)) ??
      (await sidebarOtherProject(page, url))

    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      "check-site: the sidebar's edge sets 344, 328, 428, 296, 216 and 640 px in examples/react-browser/ and keeps 328 after a reload, and examples/react-jsdom/ starts at 296 and keeps 312",
    )

    return []
  } catch (error) {
    return [`${label}: ${errorMessage(error)}`, ...failures.map((entry) => `${label}: ${entry}`)]
  } finally {
    await context.close()
  }
}

/** What each viewer theme shows. Under `system` the background depends on the machine. */
const THEMES = {
  system: { attribute: null, scheme: 'light dark', stored: null },
  light: { attribute: 'light', scheme: 'light', stored: 'light', background: LIGHT_BACKGROUND },
  dark: { attribute: 'dark', scheme: 'dark', stored: 'dark', background: DARK_BACKGROUND },
}

/**
 * The viewer theme, read in the page. With `expected`, whether the page shows
 * it, for `waitForFunction()`.
 */
function themeState({ expected }) {
  const root = document.documentElement
  const pressed = document.querySelector(
    '[role="group"][aria-label="Viewer theme"] [aria-pressed="true"]',
  )

  let stored

  try {
    stored = localStorage.getItem('describe-me:theme')
  } catch {
    stored = 'blocked'
  }

  const seen = {
    attribute: root.getAttribute('data-theme'),
    scheme: getComputedStyle(root).colorScheme,
    background: getComputedStyle(document.body).backgroundColor,
    stored,
    pressed: pressed?.getAttribute('aria-label') ?? null,
  }

  if (expected === undefined) {
    return seen
  }

  return Object.entries(expected).every(([key, value]) => seen[key] === value)
}

/** Waits until the page shows `theme`, with `overrides` on top. Returns a problem or `null`. */
async function showsTheme(page, theme, overrides = {}) {
  const expected = { ...THEMES[theme], pressed: theme, ...overrides }
  const shown = await page
    .waitForFunction(themeState, { expected }, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (shown) {
    return null
  }

  const seen = await page.evaluate(themeState, {})

  return `under the ${theme} theme the viewer shows ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`
}

function themeButton(page, theme) {
  return page
    .getByRole('group', { name: 'Viewer theme' })
    .getByRole('button', { name: theme, exact: true })
}

async function pickTheme(page, theme) {
  await themeButton(page, theme).click()
}

async function stageShot(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )

  return page.locator('.stage').screenshot()
}

/** Remembers whether `data-theme` first changed while the parser had not reached `<body>`. */
function watchThemeAttribute() {
  const observer = new MutationObserver(() => {
    window.themeBeforeBody = document.body === null
    observer.disconnect()
  })

  observer.observe(document, { subtree: true, attributeFilter: ['data-theme'] })
}

/** Under `system`, then the dark theme, then across a reload: the replayed frame stays the same. */
async function replayThemeSteps(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const before =
    (await showsTheme(page, 'system')) ?? (await showsBackground(page, RECORDED_IFRAME, 'auto'))

  if (before) {
    return before
  }

  const shot = await stageShot(page)
  const link = page.url()

  await pickTheme(page, 'dark')

  const after =
    (await showsTheme(page, 'dark')) ?? (await showsBackground(page, RECORDED_IFRAME, 'auto'))

  if (after) {
    return after
  }

  if (page.url() !== link) {
    return `the dark theme changed the link from ${link} to ${page.url()}`
  }

  if (!(await stageShot(page)).equals(shot)) {
    return 'the dark theme changed the pixels of the stage'
  }

  await page.reload()
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  if ((await page.evaluate(() => window.themeBeforeBody)) !== true) {
    return 'after a reload data-theme was not set before <body>'
  }

  const reloaded = await showsTheme(page, 'dark')

  if (reloaded) {
    return `after a reload: ${reloaded}`
  }

  await seeThrough(page, RECORDED_IFRAME)

  const problem = await eachBackground(page, RECORDED_IFRAME)

  if (problem) {
    return `under the dark theme: ${problem}`
  }

  await pickBackground(page, 'auto')

  return null
}

function linkTest() {
  return new URLSearchParams(location.hash.slice(1)).get('test')
}

/** ↓ with a theme button focused selects the next test, and the repaint keeps the focus. */
async function focusThemeSteps(page) {
  await page.locator('.tree .test').first().click()

  const first = await page.evaluate(linkTest)
  const button = themeButton(page, 'dark')

  await button.focus()
  await page.keyboard.press('ArrowDown')

  const moved = await page
    .waitForFunction(
      (test) => new URLSearchParams(location.hash.slice(1)).get('test') !== test,
      first,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false)

  if (!moved) {
    return `↓ with the dark theme button focused kept the test ${first}`
  }

  const focused = await button.evaluate((element) => document.activeElement === element)

  return focused
    ? null
    : `↓ to the test ${await page.evaluate(linkTest)} took the focus off the dark theme button`
}

/** Each theme in Live: the frame keeps its background and does not reload. */
async function liveThemeSteps(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}`)
  await page
    .locator('.live-toggle:not([aria-disabled])')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await page.keyboard.press('l')
  await page
    .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
    .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

  await page.locator(LIVE_IFRAME).evaluate((iframe) => {
    iframe.contentWindow.viewerThemeMarker = true
  })

  for (const theme of ['light', 'system', 'dark']) {
    await pickTheme(page, theme)

    const problem =
      (await showsTheme(page, theme)) ?? (await showsBackground(page, LIVE_IFRAME, 'auto'))

    if (problem) {
      return `Live: ${problem}`
    }

    const kept = await page
      .locator(LIVE_IFRAME)
      .evaluate((iframe) => iframe.contentWindow.viewerThemeMarker === true)

    if (!kept) {
      return `Live: under the ${theme} theme the live frame reloaded`
    }
  }

  await pickTheme(page, 'system')

  return showsTheme(page, 'system')
}

/** Every frame assertion of the theme, with the emulation off so frames take their own scheme. */
async function frameThemeSteps(browser, url, name) {
  const { context, page, failures } = await openLivePage(browser, url, null)
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    await page.addInitScript(watchThemeAttribute)

    const problem =
      (await replayThemeSteps(page, url, name, id)) ??
      (await focusThemeSteps(page)) ??
      (await liveThemeSteps(page, url, name, id))

    return [problem, ...failures].filter((entry) => entry !== null)
  } finally {
    await context.close()
  }
}

async function showsTree(page) {
  await page.locator('.tree .test').first().waitFor({ timeout: VIEWER_TIMEOUT })
}

/**
 * On a dark system, `system` is dark and a stored `light` survives a reload.
 * The emulation forces the scheme into every frame, so only the chrome counts.
 */
async function darkSystemThemeSteps(browser, url, name) {
  const { context, page, failures } = await openLivePage(browser, url, 'dark')

  try {
    await page.goto(`${url}examples/${name}/`)
    await showsTree(page)

    let problem = await showsTheme(page, 'system', { background: DARK_BACKGROUND })

    if (!problem) {
      await pickTheme(page, 'light')
      problem = await showsTheme(page, 'light')
    }

    if (!problem) {
      await page.reload()
      await showsTree(page)
      problem = await showsTheme(page, 'light')
    }

    return [problem, ...failures]
      .filter((entry) => entry !== null)
      .map((entry) => `on a dark system: ${entry}`)
  } finally {
    await context.close()
  }
}

/** The getter Chromium has when site data is blocked. */
function blockStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    },
  })
}

/** Without storage the switch works until a reload, with no page error. */
async function blockedThemeSteps(browser, url, name) {
  const { context, page, failures } = await openLivePage(browser, url, null)
  const blocked = { stored: 'blocked' }

  try {
    await page.addInitScript(blockStorage)
    await page.goto(`${url}examples/${name}/`)
    await showsTree(page)

    let problem = await showsTheme(page, 'system', blocked)

    if (!problem) {
      await pickTheme(page, 'dark')
      problem = await showsTheme(page, 'dark', blocked)
    }

    if (!problem) {
      await page.reload()
      await showsTree(page)
      problem = await showsTheme(page, 'system', blocked)
    }

    return [problem, ...failures]
      .filter((entry) => entry !== null)
      .map((entry) => `without storage: ${entry}`)
  } finally {
    await context.close()
  }
}

/** The viewer's own theme: stored, set before the body, and never seen by a frame. */
async function checkViewerTheme(browser, url, name) {
  const label = `examples/${name}/ viewer theme`

  try {
    const problems = [
      ...(await frameThemeSteps(browser, url, name)),
      ...(await darkSystemThemeSteps(browser, url, name)),
      ...(await blockedThemeSteps(browser, url, name)),
    ]

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ viewer theme survives a reload, is set before the body, keeps the focus, works without storage and leaves the frames alone, in replay and in Live`,
    )

    return []
  } catch (error) {
    return [`${label}: ${errorMessage(error)}`]
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
  problems.push(...(await checkLongProps(context, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkLive(browser, url, name)))
  }

  for (const name of exampleNames) {
    problems.push(...(await checkStageBackground(browser, url, name)))
  }

  for (const name of exampleNames) {
    problems.push(...(await checkLiveLoading(browser, url, name)))
  }

  problems.push(...(await checkLiveLoadingReducedMotion(browser, url)))
  problems.push(...(await checkSidebarWidth(browser, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkViewerTheme(browser, url, name)))
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
  `check-site: ok — docs.css applies, ${exampleNames.length} viewers load their tests, filter by a tag, fold long props tables, mount one in Live, show Live loading, set the stage background, keep a resized sidebar per project and keep the viewer theme out of the frames`,
)
