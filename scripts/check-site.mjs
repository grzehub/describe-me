/**
 * Checks the built site/ in headless Chromium, served over HTTP as a host would
 * serve it: docs.css applies to the pages (the light `--bg` token is the body
 * background), and each example viewer loads its data and shows as many tests
 * as its manifest has tests with a frame besides the closing one. Then Live,
 * which `pnpm site:build` builds into every viewer: `__live.json` says `ready`
 * with the base `__live/`, and a link to a test mounts it in a live frame
 * without a sandbox, on the site's own origin. In react-browser a click on
 * Actions, then Rename, in the frame shows `onSelect("Rename")` in the
 * inspector. In shadcn an email typed into the frame and a click on Request
 * access show `onSubmit("ada@example.com")`. Before the click, Request access
 * paints the `--primary` of Tailwind's CSS, which proves that the static live
 * build runs `@tailwindcss/vite`. In react-browser the tag `forms` shows on its
 * tests, the search finds them by it, `#tag=forms` and a click on the tag in
 * the inspector narrow the sidebar to them, `#tag=forms` alone opens one of
 * them, and × shows every test again. In every viewer `bg` and the background
 * switch set the stage's canvas and the frame's color scheme, in a replayed
 * frame, in Live and in the overview's thumbnails, and no frame paints an
 * opaque backdrop. The canvas takes the background the page paints, and a page
 * made see-through shows the bare canvas again. In Live under `dark` the canvas
 * takes shadcn's `.dark` body and Material UI's dark page, which the dark media
 * rule of its CSS variables gives. Under `dark` the replayed Material UI frame
 * paints its dark card, primary and page, the canvas takes the page's color,
 * and `light` takes them back. No frame these cases open says it has only a
 * light variant. In shadcn `dark` also puts `.dark` and its `--primary` on the
 * root of a replayed frame, of a frame swapped in from a link, of a thumbnail
 * and of the live page, without a new frame or a reload. `light`, `auto` under
 * the light theme and `transparent` take it back, a frame recorded in its dark
 * variant stays dark, and only the first `dark` fetches `foundations.json`.
 * `auto` under the dark viewer theme does what `dark` does, and the light theme
 * takes it back. In react-browser, whose dark variant is a media query, no
 * switch changes the root's class or attributes. With the live page held back,
 * `L` on a recorded frame keeps the dimmed recorded frame under the live frame
 * until the first status, and it fades out after. Leaving Live or picking
 * another test while it loads leaves one slot, and reduced motion keeps only
 * the dimmed frame. In react-browser a plain link opens a test in Live, while
 * `live=0`, `frame`, `L`, the timeline, a thumbnail and a preview that is
 * starting or off give the recorded frame, ↑ ↓ keep the mode, and an old link
 * with `live=1&frame=1` opens Live. The sidebar's edge sets its width with ← →
 * and by dragging, a double-click sets it back, frames ignore the pointer
 * during a drag and the stage refits after it, and each viewer keeps its own
 * width after a reload. The panel toggles of a test and of an overview, and
 * `[` `]`, hide and show the sidebar and the inspector, react-browser keeps
 * that after a reload, `/` shows the sidebar, and a narrow window starts with
 * them hidden until it widens. The viewer's theme switch sets the chrome's colors and
 * survives a reload, the stored theme is set before `<body>`, a repaint keeps a
 * focused theme button focused and the switch works without storage until a
 * reload. Under `auto` the theme, and a change of the system's scheme under
 * `system`, pick the canvas and the frames' color scheme, and under `light`,
 * `dark` and `transparent` no theme changes the link or a pixel of the stage,
 * in replay and in Live. Every case runs with the color scheme emulation off,
 * except the one on a dark system. With the react-browser manifest padded in
 * memory, a long props table folds in the overview and in the inspector, and
 * stays unfolded through a frame step and a visit to another test until the
 * page reloads. In every viewer the overview of a module with several
 * components paints the thumbnails of each component's gallery. No request to
 * the site may fail and the page may throw no error. Remote requests are
 * answered locally, so remote fonts never decide the result. Before Chromium
 * starts, every file of site/ is read as bytes, and none may name the checkout
 * or the home directory. Run after `pnpm site:build`.
 *
 * Usage: `node scripts/check-site.mjs`
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleNames } from './docs/example-names.mjs'
import { launchChromium } from './docs/launch-chromium.mjs'
import { machinePathsIn } from './docs/machine-paths-in.mjs'
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
// The bare canvas of each one the switch resolves to, where the page paints no background.
const BARE_CANVASES = { light: LIGHT_CANVAS, dark: DARK_CANVAS }
// The examples whose pages paint their body in the tests of LIVE_TESTS.
const PAINTED = ['shadcn', 'mui']
// What the live page paints under `dark`: shadcn's `--background` under `.dark`, and Material
// UI's dark `background.default`, from the dark media rule of its CSS variables.
const LIVE_DARK_PAINT = { shadcn: 'oklch(0.145 0 0)', mui: 'rgb(18, 18, 18)' }
// The note's words, in packages/viewer/src/stage-note.ts. Every frame of LIVE_TESTS records a dark
// variant, so none may say them.
const LIGHT_ONLY_WORDS = 'only a light variant'
const CSS_VARIABLES_WORDS = 'cssVariables: true'

// SidebarWidth in packages/viewer/src/sidebar-width.ts, and the most at the 1280 px of openLivePage().
const SIDEBAR = { default: 296, min: 216, step: 16, max: 640 }
const SIDEBAR_TIMEOUT = 5_000
const RECORDED_IFRAME = '.stage-slot[data-frame]:not(.incoming) iframe'
const LIVE_IFRAME = '.stage-slot.live-slot iframe'
// The style makes the page paint nothing, even where the example paints a background, so only a
// backdrop under it can differ from the bare canvas. `transition-all` in shadcn/ui would keep an
// element visible while its `visibility` transitions, so transitions are off.
const SEE_THROUGH =
  '<style>html, body { background: transparent !important; overflow: hidden !important } body * { visibility: hidden !important; transition: none !important }</style>'

async function selectsRename(page) {
  const frame = page.frameLocator('.stage-slot.live-slot iframe')

  await frame.getByRole('button', { name: 'Actions' }).click()
  await frame.getByRole('menuitem', { name: 'Rename' }).click()
  await page
    .locator('.live-actions li', { hasText: 'onSelect("Rename")' })
    .waitFor({ state: 'visible', timeout: 5_000 })

  return ', and Rename shows onSelect("Rename") in the inspector'
}

const NO_BACKGROUND = 'rgba(0, 0, 0, 0)'
const PAINT_WAIT = 5_000
const PAINT_POLL = 100

// What a replayed frame paints under each scheme: Material UI's dark `background.paper` and
// `background.default`, and the light and dark primaries of examples/mui/src/theme.ts.
const SCHEME_PAINT = {
  mui: {
    card: '.MuiCard-root',
    button: 'Choose Pro',
    dark: {
      card: 'rgb(18, 18, 18)',
      button: 'rgb(169, 156, 255)',
      paint: 'rgb(18, 18, 18)',
      canvas: 'rgb(18, 18, 18)',
    },
    light: {
      card: 'rgb(255, 255, 255)',
      button: 'rgb(91, 75, 219)',
      paint: 'rgb(255, 255, 255)',
      canvas: 'rgb(255, 255, 255)',
    },
  },
}

/** The computed background of `button` and of a probe painted with `var(--primary)`, in its document. */
function primaryBackgrounds(button) {
  const probe = button.ownerDocument.createElement('div')

  probe.style.backgroundColor = 'var(--primary)'
  button.ownerDocument.body.append(probe)

  const primary = getComputedStyle(probe).backgroundColor

  probe.remove()

  return { button: getComputedStyle(button).backgroundColor, primary }
}

/**
 * Request access paints `--primary` from Tailwind's CSS. Comparing with a probe
 * keeps Chromium's serialization of `oklch()` out of the check. It polls,
 * because the button has `transition-all`.
 */
async function paintsThePrimaryButton(page) {
  const button = page.frameLocator(LIVE_IFRAME).getByRole('button', { name: 'Request access' })
  const deadline = Date.now() + PAINT_WAIT
  let shown = null

  while (Date.now() < deadline) {
    shown = await button.evaluate(primaryBackgrounds)

    if (shown.button === shown.primary && shown.button !== NO_BACKGROUND) {
      return ', Request access paints --primary'
    }

    await new Promise((resolve) => setTimeout(resolve, PAINT_POLL))
  }

  const transparent = shown?.button === NO_BACKGROUND ? ', which is transparent' : ''

  throw new Error(
    `Request access paints ${shown?.button}${transparent}, expected --primary, which computes to ${shown?.primary}`,
  )
}

async function submitsTheEmail(page) {
  const frame = page.frameLocator(LIVE_IFRAME)

  await frame.getByRole('textbox', { name: 'Email' }).fill('ada@example.com')
  await frame.getByRole('button', { name: 'Request access' }).click()
  await page
    .locator('.live-actions li', { hasText: 'onSubmit("ada@example.com")' })
    .waitFor({ state: 'visible', timeout: 5_000 })

  return ', and Request access shows onSubmit("ada@example.com") in the inspector'
}

/**
 * The test each viewer mounts in Live, what it must paint once mounted, and
 * what to do in it after. The click of `act` leaves the pointer on a button,
 * whose hover style would change what `paint` reads.
 */
const LIVE_TESTS = {
  'react-browser': { fullName: 'Menu > selects an item and reports it', act: selectsRename },
  'react-jsdom': { fullName: 'Heading > takes its colour from the theme' },
  shadcn: {
    fullName: 'SignupCard > submits the email',
    paint: paintsThePrimaryButton,
    act: submitsTheEmail,
  },
  mui: { fullName: 'PlanCard > marks the popular plan' },
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
      await page.goto(`${base}#test=${ids.padded}&live=0`)

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
      await page.goto(`${base}#test=${ids.short}&live=0`)

      return foldProblem(page, INSPECTOR, short.props, null)
    },
    async () => {
      await page.goto(`${base}#test=${ids.padded}&live=0`)

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

/** The first module of an example whose tests render more than one component. */
function moduleWithComponents(name) {
  return readSiteManifest(name).modules.find(
    (module) => new Set(module.tests.map((test) => test.component?.name).filter(Boolean)).size > 1,
  )
}

/** Whether every thumbnail of the gallery at `index` holds its frame, read in the page. */
function galleryPainted(index) {
  const gallery = document.querySelectorAll('.overview .gallery')[index]
  const thumbs = Array.from(gallery.querySelectorAll('.thumb:not(:has(.hint))'))

  return thumbs.length > 0 && thumbs.every((thumb) => thumb.querySelector('iframe') !== null)
}

/** Each gallery of the overview, scrolled into view, paints all its thumbnails. */
async function galleriesSteps(page, url, name, moduleId) {
  await page.goto(`${url}examples/${name}/#suite=${encodeURIComponent(moduleId)}`)
  await page.locator('.overview .gallery').first().waitFor({ timeout: VIEWER_TIMEOUT })

  const count = await page.locator('.overview .gallery').count()

  if (count < 2) {
    return `the overview of ${moduleId} shows ${count} galleries, expected one per component`
  }

  for (let index = 0; index < count; index++) {
    await page.locator('.overview .gallery').nth(index).scrollIntoViewIfNeeded()

    const painted = await page
      .waitForFunction(galleryPainted, index, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!painted) {
      return `gallery ${index + 1} of ${count} in the overview of ${moduleId} has thumbnails without a frame`
    }
  }

  return null
}

/** An overview with several components paints the thumbnails of every gallery, not only the last. */
async function checkGalleries(context, url, name) {
  const label = `examples/${name}/ galleries`
  const found = moduleWithComponents(name)

  if (!found) {
    return [`${label}: no module of the manifest renders more than one component`]
  }

  const page = await context.newPage()
  const failures = []

  page.on('pageerror', (error) => failures.push(errorMessage(error)))

  try {
    const problem = await galleriesSteps(page, url, name, found.id)
    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ paints the thumbnails of every gallery in the overview of ${found.id}`,
    )

    return []
  } finally {
    await page.close()
  }
}

/**
 * A page that answers remote requests locally and keeps failed site requests
 * and page errors. `colorScheme: null`, the default, turns the emulation off,
 * so each frame takes its scheme from its iframe and the viewer theme
 * `system` is light. `reducedMotion` sets `prefers-reduced-motion`.
 */
async function openLivePage(browser, url, colorScheme = null, reducedMotion = 'no-preference') {
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
  const { fullName, paint, act } = LIVE_TESTS[name]

  await page.goto(`${url}examples/${name}/#test=${testIdOf(name, fullName)}`)
  await page
    .locator('.live-toggle[aria-pressed="true"]')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  const problems = await checkLiveIframe(page, `${url}examples/${name}/__live/live.html`)
  const link = await pageLink(page)

  if (!link.has('test') || link.has('live') || link.has('frame')) {
    problems.push(`the link in Live is #${link}, expected a test without live or frame`)
  }

  if (problems.length > 0) {
    return { problems }
  }

  await page
    .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
    .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

  const painted = paint === undefined ? '' : await paint(page)
  const acted = act === undefined ? '' : await act(page)

  return { problems: [], shown: `${painted}${acted}` }
}

/** Live in the viewer of the site: `__live.json`, then one test mounted from a plain link. */
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
 * What the stage and the frame at `selector` show, read in the page. `paint`
 * is what the frame's page paints: the background of `html`, or of `body`
 * when `html` paints none. Every frame here is same-origin, the live one
 * included. With `expected`, whether they show it, for `waitForFunction()`.
 * Its `bare` is the canvas expected where the page paints nothing, and
 * otherwise the stage must take the page's paint.
 */
function stageBackground({ selector, expected }) {
  const element = document.querySelector('.stage')
  const stage = getComputedStyle(element)
  const iframe = document.querySelector(selector)
  const frameDocument = iframe?.contentDocument
  const view = frameDocument?.defaultView
  const html = view ? view.getComputedStyle(frameDocument.documentElement).backgroundColor : null
  const pressed = document.querySelectorAll('.backgrounds [aria-pressed="true"]')
  const seen = {
    canvas: stage.backgroundColor,
    image: stage.backgroundImage !== 'none',
    dataCanvas: element.dataset.canvas ?? null,
    paint:
      html === 'rgba(0, 0, 0, 0)'
        ? view.getComputedStyle(frameDocument.body).backgroundColor
        : html,
    scheme: iframe ? getComputedStyle(iframe).colorScheme : 'no frame',
    dark: iframe?.contentWindow?.matchMedia('(prefers-color-scheme: dark)').matches ?? null,
    pressed: Array.from(pressed, (button) => button.getAttribute('aria-label')).join(' '),
  }

  if (expected === undefined) {
    return seen
  }

  const { bare, ...exact } = expected
  const canvas = seen.paint === 'rgba(0, 0, 0, 0)' ? bare : seen.paint

  return (
    (bare === undefined || seen.canvas === canvas) &&
    Object.entries(exact).every(([key, value]) => seen[key] === value)
  )
}

/**
 * Waits until the stage and the frame at `selector` show `value`. `auto`
 * resolves to `theme`, the viewer theme, because no page check-site shows
 * under `auto` declares a scheme or paints dark. `transparent` shows the
 * checkerboard, and the others the page's paint or the bare canvas. Returns
 * a problem or `null`.
 */
async function showsBackground(page, selector, value, theme = 'light') {
  const resolved = value === 'auto' ? theme : value
  const canvas =
    resolved === 'transparent' ? { image: true } : { image: false, bare: BARE_CANVASES[resolved] }

  const expected = {
    ...canvas,
    dataCanvas: resolved,
    scheme: resolved === 'dark' ? 'dark' : 'light',
    dark: resolved === 'dark',
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

/** The link's parameters, read in the page. */
async function pageLink(page) {
  return new URLSearchParams(await page.evaluate(() => location.hash.slice(1)))
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
 * SEE_THROUGH makes its page paint nothing, the background of the shadcn and
 * Material UI examples included, so only Chromium's opaque backdrop can.
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

/**
 * Each value of the switch on the frame at `selector`: canvas, scheme, media
 * query and no backdrop, with `auto` resolved by the viewer theme `theme`.
 */
async function eachBackground(page, selector, check = async () => null, theme = 'light') {
  for (const value of BACKGROUNDS) {
    await pickBackground(page, value)

    const problem = (await showsBackground(page, selector, value, theme)) ?? (await check(value))

    if (problem) {
      return problem
    }

    if (await paintsBackdrop(page, selector)) {
      return `with ${value} the frame paints a backdrop over the canvas`
    }
  }

  return null
}

/** The note under the stage, read in the page: its text, empty while it is hidden. */
function stageNote() {
  const note = document.querySelector('.stage-note')

  return note === null || note.hidden ? '' : note.textContent
}

/**
 * Waits until the note says neither that the frame has only a light variant
 * nor that Material UI records both with `cssVariables: true`. Neither must
 * still hold after SETTLE_MS, in case the note comes with the frame's fonts.
 * Returns a problem or `null`.
 */
async function showsNote(page) {
  const sentences = [LIGHT_ONLY_WORDS, CSS_VARIABLES_WORDS]
  const shown = await page
    .waitForFunction(
      (words) => {
        const note = document.querySelector('.stage-note')
        const text = note === null || note.hidden ? '' : note.textContent

        return words.every((word) => !text.includes(word))
      },
      sentences,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false)

  if (shown) {
    await page.waitForTimeout(SETTLE_MS)
  }

  const text = await page.evaluate(stageNote)

  if (shown && sentences.every((word) => !text.includes(word))) {
    return null
  }

  return `the note says "${text}", expected neither "${LIGHT_ONLY_WORDS}" nor "${CSS_VARIABLES_WORDS}"`
}

/** What the frame at `selector` paints, read in the page: its card, its primary button, its page and the canvas. */
function schemePaint({ selector, card, button }) {
  const frameDocument = document.querySelector(selector).contentDocument
  const view = frameDocument.defaultView
  const backgroundOf = (element) =>
    element ? view.getComputedStyle(element).backgroundColor : null

  const html = backgroundOf(frameDocument.documentElement)
  const primary = Array.from(frameDocument.querySelectorAll('button')).find(
    (candidate) => candidate.textContent.trim() === button,
  )

  return {
    card: backgroundOf(frameDocument.querySelector(card)),
    button: backgroundOf(primary),
    paint: html === 'rgba(0, 0, 0, 0)' ? backgroundOf(frameDocument.body) : html,
    canvas: getComputedStyle(document.querySelector('.stage')).backgroundColor,
  }
}

/**
 * Waits until the replayed frame of `name` paints `scheme` as SCHEME_PAINT
 * says, for an example with an entry there. It polls, because the frame
 * starts light and Material UI's Button transitions `background-color`.
 * Returns a problem or `null`.
 */
async function paintsTheScheme(page, name, scheme) {
  const expected = SCHEME_PAINT[name]?.[scheme]

  if (expected === undefined) {
    return null
  }

  const { card, button } = SCHEME_PAINT[name]
  const deadline = Date.now() + PAINT_WAIT
  let shown = null

  while (Date.now() < deadline) {
    shown = await page.evaluate(schemePaint, { selector: RECORDED_IFRAME, card, button })

    if (JSON.stringify(shown) === JSON.stringify(expected)) {
      return null
    }

    await new Promise((resolve) => setTimeout(resolve, PAINT_POLL))
  }

  return `the frame paints ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`
}

/**
 * `bg=dark` in the link, then the switch, in a replayed frame. A page that
 * paints its body must paint under `dark` too, so the check is never vacuous.
 * Material UI's frame paints its dark card, primary and page from the dark
 * media rule of its CSS variables, and `light` takes them back. No frame gets
 * the note. Through the see-through style every example shows the bare
 * canvases, so the stage reads the page again on a switch.
 */
async function replaySteps(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}&bg=dark&live=0`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const linked = await showsBackground(page, RECORDED_IFRAME, 'dark')

  if (linked) {
    return `#bg=dark: ${linked}`
  }

  const { paint } = await page.evaluate(stageBackground, { selector: RECORDED_IFRAME })

  if (PAINTED.includes(name) && paint === NO_BACKGROUND) {
    return `#bg=dark: the page paints ${paint}, expected a background of its own`
  }

  const darkProblem = (await showsNote(page)) ?? (await paintsTheScheme(page, name, 'dark'))

  if (darkProblem) {
    return `#bg=dark: ${darkProblem}`
  }

  for (const [value, expected] of [
    ['light', 'light'],
    ['transparent', 'transparent'],
    ['auto', null],
  ]) {
    await pickBackground(page, value)

    const problem =
      (await showsBackground(page, RECORDED_IFRAME, value)) ??
      (await showsNote(page)) ??
      (value === 'light' ? await paintsTheScheme(page, name, 'light') : null)

    if (problem) {
      return `with ${value}: ${problem}`
    }

    const linked = linkBackground(page)

    if (linked !== expected) {
      return `with ${value} the link has bg=${linked}, expected ${expected}`
    }
  }

  await seeThrough(page, RECORDED_IFRAME)

  const seen = await eachBackground(page, RECORDED_IFRAME)

  return seen ? `see-through: ${seen}` : null
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

/**
 * Live under `dark`: the canvas takes the background the live page reports,
 * shadcn's `.dark` body and Material UI's dark page from the dark media rule
 * of its CSS variables, and no note shows.
 */
async function liveDarkSteps(page, name) {
  await pickBackground(page, 'dark')

  const problem = (await showsBackground(page, LIVE_IFRAME, 'dark')) ?? (await showsNote(page))

  if (problem) {
    return problem
  }

  const { canvas } = await page.evaluate(stageBackground, { selector: LIVE_IFRAME })
  const expected = LIVE_DARK_PAINT[name] ?? DARK_CANVAS

  return canvas === expected ? null : `the canvas is ${canvas}, expected ${expected}`
}

/**
 * The switch in Live, which must not reload the live frame. Through the
 * see-through style every example shows the bare canvases, so the live page
 * reports a change in its `<head>`.
 */
async function liveSteps(page, name) {
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

  const dark = await liveDarkSteps(page, name)

  if (dark) {
    return `Live, with dark: ${dark}`
  }

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

  return null
}

/**
 * `bg=dark` in the link of an overview: the first thumbnail's canvas, scheme
 * and media query. The canvas is the thumbnail page's paint when it paints.
 */
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

  const seen = await iframe.evaluate((element) => {
    const frameDocument = element.contentDocument
    const html = getComputedStyle(frameDocument.documentElement).backgroundColor

    return {
      media: element.contentWindow.matchMedia('(prefers-color-scheme: dark)').matches,
      canvas: getComputedStyle(element.closest('.thumb')).backgroundColor,
      paint:
        html === 'rgba(0, 0, 0, 0)' ? getComputedStyle(frameDocument.body).backgroundColor : html,
    }
  })

  const canvas = seen.paint === NO_BACKGROUND ? DARK_CANVAS : seen.paint

  if (!dark || !seen.media || seen.canvas !== canvas) {
    return `the first thumbnail of #suite=…&bg=dark shows ${JSON.stringify({ dark, ...seen })}`
  }

  return null
}

/** The stage background: `bg` in the link, the switch, the page's paint, the note, Live and the overview. */
async function checkStageBackground(browser, url, name) {
  const label = `examples/${name}/ stage background`
  const { context, page, failures } = await openLivePage(browser, url)
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    const problem =
      (await replaySteps(page, url, name, id)) ??
      (await liveSteps(page, name)) ??
      (await overviewSteps(page, url, name, id))

    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ bg sets the canvas and the frames' color scheme, and the canvas takes the page's background, in replay, in Live and in the overview, with no backdrop`,
    )

    if (SCHEME_PAINT[name]) {
      console.log(
        `check-site: examples/${name}/ a replayed frame under dark paints the dark card, the dark primary and the dark page, which the canvas takes, and light takes them back`,
      )
    }

    return []
  } catch (error) {
    return [`${label}: ${[errorMessage(error), ...failures].join(', ')}`]
  } finally {
    await context.close()
  }
}

// --primary of examples/shadcn/src/index.css, the values of DARK_CASES in scripts/check-foundations/check-view.mjs.
const PRIMARY = { light: 'oklch(0.52 0.23 285)', dark: 'oklch(0.7 0.18 285)' }

/** The shadcn tests the dark variant cases show: one recorded light, one recorded in its dark variant. */
const DARK_VARIANT = {
  name: 'shadcn',
  light: 'SignupCard > submits the email',
  recordedDark: 'Button > renders every variant in the dark variant',
}

const VARIANT_WAIT = 5_000
// Messages to the live page are tasks of their own, so a root that must stay as it is waits this long first.
const SETTLE_MS = 300

/**
 * The root of the frame at `selector`, read in the page: whether it has the
 * class `dark`, its `--primary`, its class and attribute names, and whether
 * the iframe element and its window still carry the check's markers.
 */
function frameRoot(selector) {
  const iframe = document.querySelector(selector)
  const root = iframe?.contentDocument?.documentElement

  if (!root) {
    return null
  }

  return {
    dark: root.classList.contains('dark'),
    primary: iframe.contentWindow.getComputedStyle(root).getPropertyValue('--primary').trim(),
    names: [...root.classList, ...root.getAttributeNames()].sort().join(' '),
    sameIframe: iframe.darkVariantMarker === true,
    sameWindow: iframe.contentWindow.darkVariantMarker === true,
  }
}

/** Marks the iframe at `selector` and its window, so a later read tells a new frame or a reload. */
async function markFrame(page, selector) {
  await page.locator(selector).evaluate((iframe) => {
    iframe.darkVariantMarker = true
    iframe.contentWindow.darkVariantMarker = true
  })
}

/** Polls the root at `selector` until it shows the variant `dark`, or `false` for the light one. */
async function showsVariant(page, selector, dark) {
  const expected = { dark, primary: dark ? PRIMARY.dark : PRIMARY.light }
  const deadline = Date.now() + VARIANT_WAIT
  let seen = null

  while (Date.now() < deadline) {
    seen = await page.evaluate(frameRoot, selector)

    if (seen?.dark === expected.dark && seen.primary === expected.primary) {
      return { seen, problem: null }
    }

    await new Promise((resolve) => setTimeout(resolve, PAINT_POLL))
  }

  return {
    seen,
    problem: `the root shows ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`,
  }
}

/** Counts the viewer's requests for `foundations.json`. */
function countFoundations(page) {
  const counter = { requests: 0 }

  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/__data/foundations.json')) {
      counter.requests += 1
    }
  })

  return counter
}

/** A new document, because a link that differs only in its hash would not reload the viewer. */
async function freshLoad(page, target) {
  await page.goto('about:blank')
  await page.goto(target)
}

/** a–c: the switch on a replayed frame, the same iframe throughout, and one fetch. */
async function replayVariantSteps(page, base, id, counter) {
  await page.goto(`${base}#test=${id}&live=0`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const plain = await showsVariant(page, RECORDED_IFRAME, false)

  if (plain.problem || counter.requests !== 0) {
    return `without bg: ${plain.problem ?? `${counter.requests} requests for foundations.json, expected none`}`
  }

  await markFrame(page, RECORDED_IFRAME)

  for (const value of ['dark', 'light', 'auto', 'transparent']) {
    await pickBackground(page, value)

    const shown = await showsVariant(page, RECORDED_IFRAME, value === 'dark')

    if (shown.problem) {
      return `with ${value}: ${shown.problem}`
    }

    if (!shown.seen.sameIframe) {
      return `with ${value}: the recorded iframe was replaced`
    }

    if (counter.requests !== 1) {
      return `with ${value}: ${counter.requests} requests for foundations.json, expected one since the first dark`
    }
  }

  return null
}

/** d: a link with `bg=dark` swaps the frame in with its dark variant already on. */
async function linkedVariantStep(page, base, id) {
  await freshLoad(page, `${base}#test=${id}&bg=dark&live=0`)

  const first = await page
    .waitForFunction(frameRoot, RECORDED_IFRAME, { timeout: VIEWER_TIMEOUT })
    .then((handle) => handle.jsonValue())

  if (!first.dark || first.primary !== PRIMARY.dark) {
    return `#bg=dark: the frame swapped in with ${JSON.stringify(first)}`
  }

  return null
}

/** e: a frame recorded in its dark variant stays dark under every switch. */
async function recordedDarkSteps(page, base, id) {
  await page.goto(`${base}#test=${id}&live=0`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  for (const value of ['light', 'dark', 'light']) {
    await pickBackground(page, value)

    const problem =
      (await showsBackground(page, RECORDED_IFRAME, value)) ??
      (await showsVariant(page, RECORDED_IFRAME, true)).problem

    if (problem) {
      return `recorded dark, with ${value}: ${problem}`
    }
  }

  return null
}

/** f: the overview's first thumbnail under `bg=dark`. */
async function thumbVariantStep(page, base, id) {
  const moduleId = readSiteManifest(DARK_VARIANT.name).modules.find((candidate) =>
    candidate.tests.some((test) => test.id === id),
  ).id

  await freshLoad(page, `${base}#suite=${encodeURIComponent(moduleId)}&bg=dark`)
  await page
    .locator('.thumb iframe')
    .first()
    .waitFor({ state: 'attached', timeout: VIEWER_TIMEOUT })

  const shown = await showsVariant(page, '.thumb iframe', true)

  return shown.problem ? `the first thumbnail of #suite=…&bg=dark: ${shown.problem}` : null
}

async function mountedInLive(page) {
  await page
    .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
    .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT })

  await faded(page)
}

/** g: the switch in Live, which posts the variant to the live page without reloading it. */
async function liveVariantSteps(page, base, id) {
  await freshLoad(page, `${base}#test=${id}`)
  await page
    .locator('.live-toggle[aria-pressed="true"]')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await mountedInLive(page)
  await markFrame(page, LIVE_IFRAME)

  for (const value of ['dark', 'light']) {
    await pickBackground(page, value)

    const shown = await showsVariant(page, LIVE_IFRAME, value === 'dark')

    if (shown.problem) {
      return `Live, with ${value}: ${shown.problem}`
    }

    if (!shown.seen.sameWindow) {
      return `Live, with ${value}: the live frame reloaded`
    }
  }

  return null
}

/** h: a test recorded in its dark variant, opened in Live with `bg=dark`, keeps its class under `light`. */
async function liveRecordedDarkSteps(page, base, id) {
  await freshLoad(page, `${base}#test=${id}&live=1&bg=dark`)
  await mountedInLive(page)

  const mounted = await showsVariant(page, LIVE_IFRAME, true)

  if (mounted.problem) {
    return `Live, recorded dark with live=1&bg=dark: ${mounted.problem}`
  }

  const link = await pageLink(page)

  if (link.get('bg') !== 'dark' || link.has('live')) {
    return `Live, recorded dark with live=1&bg=dark: the link reads #${link}, expected bg=dark without live`
  }

  await pickBackground(page, 'light')

  const switched = await showsBackground(page, LIVE_IFRAME, 'light')

  if (switched) {
    return `Live, recorded dark, with light: ${switched}`
  }

  await page.waitForTimeout(SETTLE_MS)

  const kept = await showsVariant(page, LIVE_IFRAME, true)

  return kept.problem ? `Live, recorded dark, with light: ${kept.problem}` : null
}

/**
 * Under `auto`, the dark theme puts the variant on the root at `selector` and
 * the light theme takes it back, in the same iframe and window. Ends under
 * the light theme.
 */
async function themeVariantSteps(page, selector) {
  await markFrame(page, selector)

  for (const theme of ['dark', 'light']) {
    await pickTheme(page, theme)

    const shown = await showsVariant(page, selector, theme === 'dark')

    if (shown.problem) {
      return `under the ${theme} theme: ${shown.problem}`
    }

    if (!shown.seen.sameIframe || !shown.seen.sameWindow) {
      return `under the ${theme} theme the frame was replaced or reloaded`
    }
  }

  return null
}

/**
 * i: `auto` that resolves to dark is `bg=dark`. Under the dark theme a
 * replayed frame, a thumbnail and the live page get the variant, without a
 * new frame or a reload. The light theme takes it back. The overview rebuilds
 * its thumbnails on a change of the theme, so its first one is read under
 * each theme in turn. Ends under `system`.
 */
async function autoThemeVariantSteps(page, base, id) {
  await freshLoad(page, `${base}#test=${id}&live=0`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const replayed = await themeVariantSteps(page, RECORDED_IFRAME)

  if (replayed) {
    return `auto, replay: ${replayed}`
  }

  const moduleId = readSiteManifest(DARK_VARIANT.name).modules.find((candidate) =>
    candidate.tests.some((test) => test.id === id),
  ).id

  await pickTheme(page, 'dark')
  await freshLoad(page, `${base}#suite=${encodeURIComponent(moduleId)}`)

  for (const theme of ['dark', 'light']) {
    await pickTheme(page, theme)
    await page
      .locator('.thumb iframe')
      .first()
      .waitFor({ state: 'attached', timeout: VIEWER_TIMEOUT })

    const thumb = await showsVariant(page, '.thumb iframe', theme === 'dark')

    if (thumb.problem) {
      return `auto, the first thumbnail under the ${theme} theme: ${thumb.problem}`
    }
  }

  await freshLoad(page, `${base}#test=${id}`)
  await page
    .locator('.live-toggle[aria-pressed="true"]')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await mountedInLive(page)

  const live = await themeVariantSteps(page, LIVE_IFRAME)

  await pickTheme(page, 'system')

  return live ? `auto, Live: ${live}` : null
}

/** react-browser's dark variant is a media query, so no switch touches the root of a frame. */
async function sameRootNames(page, selector) {
  const names = {}

  for (const value of ['light', 'dark']) {
    await pickBackground(page, value)

    const switched = await showsBackground(page, selector, value)

    if (switched) {
      return switched
    }

    await page.waitForTimeout(SETTLE_MS)
    names[value] = (await page.evaluate(frameRoot, selector))?.names
  }

  return names.light === names.dark
    ? null
    : `the root has "${names.light}" under light and "${names.dark}" under dark`
}

async function mediaOnlySteps(page, url) {
  const name = 'react-browser'
  const base = `${url}examples/${name}/`

  await page.goto(`${base}#test=${testIdOf(name, LIVE_TESTS[name].fullName)}&live=0`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const replayed = await sameRootNames(page, RECORDED_IFRAME)

  if (replayed) {
    return `${name}, replay: ${replayed}`
  }

  await page
    .locator('.live-toggle:not([aria-disabled])')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await page.keyboard.press('l')
  await mountedInLive(page)

  const live = await sameRootNames(page, LIVE_IFRAME)

  return live ? `${name}, Live: ${live}` : null
}

/**
 * The dark variant of shadcn under `bg=dark`, and under `auto` with the dark
 * viewer theme, on the root of a replayed frame, a frame swapped in from a
 * link, a thumbnail and the live page, and the root of react-browser, whose
 * dark variant is a media query, left alone.
 */
async function checkStageDarkVariant(browser, url) {
  const label = 'stage dark variant'
  const { context, page, failures } = await openLivePage(browser, url)
  const counter = countFoundations(page)
  const base = `${url}examples/${DARK_VARIANT.name}/`
  const light = testIdOf(DARK_VARIANT.name, DARK_VARIANT.light)
  const recordedDark = testIdOf(DARK_VARIANT.name, DARK_VARIANT.recordedDark)

  try {
    const problem =
      (await replayVariantSteps(page, base, light, counter)) ??
      (await linkedVariantStep(page, base, light)) ??
      (await recordedDarkSteps(page, base, recordedDark)) ??
      (await thumbVariantStep(page, base, light)) ??
      (await liveVariantSteps(page, base, light)) ??
      (await liveRecordedDarkSteps(page, base, recordedDark))

    if (problem) {
      return [problem, ...failures].map(
        (entry) => `examples/${DARK_VARIANT.name}/ ${label}: ${entry}`,
      )
    }

    console.log(
      `check-site: examples/${DARK_VARIANT.name}/ bg=dark puts .dark on the root of a replayed frame, a frame from a link, a thumbnail and the live page without a reload, light, auto under the light theme and transparent take it back, a frame recorded dark stays dark, and foundations.json loads once, on the first dark`,
    )

    const autoTheme = await autoThemeVariantSteps(page, base, light)

    if (autoTheme) {
      return [autoTheme, ...failures].map(
        (entry) => `examples/${DARK_VARIANT.name}/ ${label}: ${entry}`,
      )
    }

    console.log(
      `check-site: examples/${DARK_VARIANT.name}/ auto under the dark viewer theme puts .dark on the root of a replayed frame, a thumbnail and the live page without a reload, as bg=dark does, and the light theme takes it back`,
    )

    const mediaOnly = await mediaOnlySteps(page, url)
    const problems = [mediaOnly, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `examples/react-browser/ ${label}: ${entry}`)
    }

    console.log(
      'check-site: examples/react-browser/ bg=dark leaves the root of a replayed frame and of the live page alone, because its dark variant is a media query',
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
  await page.goto(`${url}examples/${name}/#test=${id}&live=0`)
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
  const { context, page, failures } = await openLivePage(browser, url, null, 'reduce')
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

/** The react-browser tests of the Live-by-default check: one with three frames, then the two after it in the sidebar. */
const BY_DEFAULT = {
  name: 'react-browser',
  tests: [
    'Counter > increments',
    'Counter > does not go below the minimum',
    'Counter > resets to the initial value',
  ],
}

const STARTING = JSON.stringify({ status: 'starting' })
const OFF = JSON.stringify({ status: 'off' })

function described(key, value) {
  return value === null ? `no ${key}` : `${key}=${value}`
}

/** A problem when the link does not name `test` with `live` and `frame` as given, `null` for none. */
async function linkProblem(page, { test, live = null, frame = null }) {
  const link = await pageLink(page)

  if (link.get('test') === test && link.get('live') === live && link.get('frame') === frame) {
    return null
  }

  return `the link is #${link}, expected test=${test}, ${described('live', live)} and ${described('frame', frame)}`
}

/** Waits until the test `id` shows its recorded frame `frame`. */
async function showsRecordedFrame(page, id, frame) {
  await page
    .locator(`.stage-slot[data-test="${id}"][data-frame="${frame}"]:not(.incoming) iframe`)
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })
}

/** Waits until the toggle is on and the live slot of the test `id` has mounted. */
async function mountsInLive(page, id) {
  await page
    .locator('.live-toggle[aria-pressed="true"]')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await page
    .locator(`.stage-slot.live-slot[data-test="${id}"]:not(.loading)`)
    .waitFor({ state: 'attached', timeout: LIVE_TIMEOUT })

  await mountedInLive(page)
}

/** Whether no live slot shows up within SETTLE_MS of the toggle turning usable. */
async function staysRecorded(page) {
  await page
    .locator('.live-toggle:not([aria-disabled])')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await page.waitForTimeout(SETTLE_MS)

  return (await page.locator('.stage-slot.live-slot').count()) === 0
}

/** The click on the breadcrumbs takes the focus off any frame, so the key reaches the viewer. */
async function pressInViewer(page, key) {
  await page.locator('.crumbs .path').click()
  await page.keyboard.press(key)
}

/** a: a plain link opens the test in Live, with no active frame and neither `live` nor `frame` in the link. */
async function plainLinkStep(page, base, ids) {
  await freshLoad(page, `${base}#test=${ids[0]}`)
  await mountsInLive(page, ids[0])

  const problems = await checkLiveIframe(page, `${base}__live/live.html`)

  if (problems.length > 0) {
    return problems.join(', ')
  }

  if ((await page.locator('.timeline .frame.active').count()) > 0) {
    return 'a frame of the timeline is active in Live'
  }

  return linkProblem(page, { test: ids[0] })
}

/** b: `L` leaves Live for the recorded frame 0, and the link says `live=0`. */
async function pressLStep(page, ids) {
  await page.locator('.crumbs .path').click()
  await leaveLive(page)
  await showsRecordedFrame(page, ids[0], 0)

  return linkProblem(page, { test: ids[0], live: '0' })
}

/** c: ↓ keeps the recorded frames, `L` mounts the test, then ↓ and ↑ keep Live. */
async function arrowSteps(page, ids) {
  await pressInViewer(page, 'ArrowDown')
  await showsRecordedFrame(page, ids[1], 0)

  const recorded = await linkProblem(page, { test: ids[1], live: '0' })

  if (recorded) {
    return `↓ on a recorded frame: ${recorded}`
  }

  const moves = [
    ['L on the recorded frame', 'l', ids[1]],
    ['↓ in Live', 'ArrowDown', ids[2]],
    ['↑ in Live', 'ArrowUp', ids[1]],
    ['↑ in Live again', 'ArrowUp', ids[0]],
  ]

  for (const [move, key, id] of moves) {
    await pressInViewer(page, key)
    await mountsInLive(page, id)

    const problem = await linkProblem(page, { test: id })

    if (problem) {
      return `${move}: ${problem}`
    }
  }

  return null
}

/** d: a click on the timeline's second frame leaves Live for that frame. */
async function timelineStep(page, ids) {
  await page.locator('.timeline .frame').nth(1).click()
  await showsRecordedFrame(page, ids[0], 1)

  return linkProblem(page, { test: ids[0], frame: '1' })
}

/** e: `live=0` opens the recorded frame 0, which stays once the preview is ready. */
async function liveOffStep(page, base, ids) {
  await freshLoad(page, `${base}#test=${ids[0]}&live=0`)
  await showsRecordedFrame(page, ids[0], 0)

  if (!(await staysRecorded(page))) {
    return 'live=0: a live slot showed up'
  }

  return linkProblem(page, { test: ids[0], live: '0' })
}

function rewrittenToLiveOff() {
  const link = new URLSearchParams(location.hash.slice(1))

  return link.get('live') === '0' && !link.has('frame')
}

/** f: `frame=0` opens the recorded frame 0 and becomes `live=0`, and `frame=2` opens and keeps that frame. */
async function frameLinkSteps(page, base, ids) {
  await freshLoad(page, `${base}#test=${ids[0]}&frame=0`)
  await showsRecordedFrame(page, ids[0], 0)

  const rewritten = await page
    .waitForFunction(rewrittenToLiveOff, undefined, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (!rewritten) {
    return `frame=0: the link is #${await pageLink(page)}, expected live=0 and no frame`
  }

  await freshLoad(page, `${base}#test=${ids[0]}&frame=2`)
  await showsRecordedFrame(page, ids[0], 2)

  if (!(await staysRecorded(page))) {
    return 'frame=2: a live slot showed up'
  }

  const kept = await linkProblem(page, { test: ids[0], frame: '2' })

  return kept ? `frame=2: ${kept}` : null
}

/** g: an old link with `live=1&frame=1` opens Live, and the viewer rewrites it to the test alone. */
async function oldLinkStep(page, base, ids) {
  await freshLoad(page, `${base}#test=${ids[0]}&live=1&frame=1`)
  await mountsInLive(page, ids[0])

  const link = await pageLink(page)

  if ([...link.keys()].join() === 'test' && link.get('test') === ids[0]) {
    return null
  }

  return `live=1&frame=1: the link is #${link}, expected test=${ids[0]} alone`
}

/** h: a thumbnail of the overview opens its recorded frame, not Live. */
async function thumbnailStep(page, base, ids) {
  const { name, tests } = BY_DEFAULT
  const moduleId = readSiteManifest(name).modules.find((candidate) =>
    candidate.tests.some((test) => test.id === ids[0]),
  ).id

  await freshLoad(page, `${base}#suite=${encodeURIComponent(moduleId)}`)
  await page.locator(`.overview .gallery .tile[title="${tests[0]}"]`).click()
  await showsRecordedFrame(page, ids[0], 2)

  if (!(await staysRecorded(page))) {
    return 'the thumbnail: a live slot showed up'
  }

  return linkProblem(page, { test: ids[0], frame: '2' })
}

/** A page whose `__live.json` answers `body` until `release()`, then the site's own file. */
async function previewPage(browser, url, body) {
  const opened = await openLivePage(browser, url)
  const gate = { released: false }

  await opened.page.route('**/__live.json', (route) =>
    gate.released
      ? route.fallback()
      : route.fulfill({ status: 200, contentType: 'application/json', body }),
  )

  return {
    ...opened,
    release: () => {
      gate.released = true
    },
  }
}

/**
 * i: while the preview starts, the recorded frame 0 shows. The viewer polls
 * every 500 ms, so once released the test switches to Live, unless `hash`
 * has `live=0`.
 */
async function startingStep(browser, url, base, id, hash) {
  const { context, page, failures, release } = await previewPage(browser, url, STARTING)
  const live = hash === '' ? null : '0'

  try {
    await page.goto(`${base}#test=${id}${hash}`)
    await showsRecordedFrame(page, id, 0)
    await page
      .locator('.live-toggle[aria-disabled="true"]')
      .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

    const starting = await linkProblem(page, { test: id, live })

    if (starting) {
      return `while it starts: ${starting}`
    }

    release()

    if (live === null) {
      await mountsInLive(page, id)
    } else if (!(await staysRecorded(page))) {
      return 'once ready: a live slot showed up'
    }

    const ready = await linkProblem(page, { test: id, live })

    if (ready) {
      return `once ready: ${ready}`
    }

    return failures.length > 0 ? failures.join(', ') : null
  } finally {
    await context.close()
  }
}

/** i: with the preview off, a plain link shows the recorded frame 0 and no toggle. */
async function offStep(browser, url, base, id) {
  const { context, page, failures } = await previewPage(browser, url, OFF)

  try {
    const answered = page
      .waitForResponse((response) => new URL(response.url()).pathname.endsWith('/__live.json'), {
        timeout: VIEWER_TIMEOUT,
      })
      .catch(() => null)

    await page.goto(`${base}#test=${id}`)

    if ((await answered) === null) {
      return 'the viewer never asked for __live.json'
    }

    await showsRecordedFrame(page, id, 0)
    await page.waitForTimeout(SETTLE_MS)

    if (await page.locator('.live-toggle').isVisible()) {
      return 'the Live toggle shows'
    }

    if ((await page.locator('.stage-slot.live-slot').count()) > 0) {
      return 'a live slot showed up'
    }

    const link = await linkProblem(page, { test: id })

    if (link) {
      return link
    }

    return failures.length > 0 ? failures.join(', ') : null
  } finally {
    await context.close()
  }
}

/** Live by default: a plain link opens it, and the recorded frames stay one key, click or link away. */
async function checkLiveByDefault(browser, url) {
  const { name, tests } = BY_DEFAULT
  const label = `examples/${name}/ Live by default`
  const base = `${url}examples/${name}/`
  const ids = tests.map((fullName) => testIdOf(name, fullName))
  const { context, page, failures } = await openLivePage(browser, url)
  const steps = [
    ['a', () => plainLinkStep(page, base, ids)],
    ['b', () => pressLStep(page, ids)],
    ['c', () => arrowSteps(page, ids)],
    ['d', () => timelineStep(page, ids)],
    ['e', () => liveOffStep(page, base, ids)],
    ['f', () => frameLinkSteps(page, base, ids)],
    ['g', () => oldLinkStep(page, base, ids)],
    ['h', () => thumbnailStep(page, base, ids)],
    ['i, starting', () => startingStep(browser, url, base, ids[0], '')],
    ['i, starting with live=0', () => startingStep(browser, url, base, ids[0], '&live=0')],
    ['i, off', () => offStep(browser, url, base, ids[0])],
  ]

  let current = steps[0][0]

  try {
    for (const [step, run] of steps) {
      current = step

      const problem = await run()

      if (problem) {
        return [`step ${step}: ${problem}`, ...failures].map((entry) => `${label}: ${entry}`)
      }
    }

    if (failures.length > 0) {
      return failures.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ opens a test in Live from a plain link, L, the timeline, live=0, frame and a thumbnail give the recorded frame, ↑ ↓ keep the mode, an old live=1&frame=1 link opens Live and is rewritten to the test alone, a starting preview shows the recorded frame 0 and switches to Live once ready unless the link has live=0, and an off preview shows only recorded frames`,
    )

    return []
  } catch (error) {
    return [`${label}: step ${current}: ${[errorMessage(error), ...failures].join(', ')}`]
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

/** What the panels show: each panel, the center's width and the toggles of the view on screen. */
function panelLayout(page) {
  return page.evaluate(() => {
    const shown = (selector) => !document.querySelector(selector).hidden
    const toggles = [...document.querySelectorAll('.panel-toggle button')].filter(
      (button) => button.offsetParent !== null,
    )

    return {
      sidebar: shown('.sidebar'),
      handle: shown('.sidebar-handle'),
      inspector: shown('.inspector'),
      center: Math.round(document.querySelector('.center').getBoundingClientRect().width),
      toggles: toggles.map(
        (button) => `${button.dataset.panel}=${button.getAttribute('aria-expanded')}`,
      ),
    }
  })
}

/** Whether the panels settle as `expected` says, with both toggles of the view in step. */
async function showsPanels(page, step, expected) {
  const want = {
    sidebar: expected.sidebar,
    handle: expected.sidebar,
    inspector: expected.inspector,
    center: expected.center,
    toggles: [`sidebar=${expected.sidebar}`, `inspector=${expected.inspector}`],
  }

  const deadline = Date.now() + SIDEBAR_TIMEOUT
  let shown = null

  while (Date.now() < deadline) {
    shown = await panelLayout(page)

    if (JSON.stringify(shown) === JSON.stringify(want)) {
      return null
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return `${step}: ${JSON.stringify(shown)}, expected ${JSON.stringify(want)}`
}

/** Each step acts, then the panels must settle as it expects. Returns the first problem or `null`. */
async function panelSteps(page, steps) {
  for (const { step, act, expected } of steps) {
    await act()

    const problem = await showsPanels(page, step, expected)

    if (problem) {
      return problem
    }
  }

  return null
}

/** The toggles and keys in a test, then after a reload, then in an overview, at 1280 px. */
async function panelToggleSteps(page, key) {
  const both = 1280 - SIDEBAR.default - 320
  const crumbsToggle = (panel) => page.locator(`.crumbs .panel-toggle [data-panel=${panel}]`)
  const overviewToggle = (panel) =>
    page.locator(`.overview-head .panel-toggle [data-panel=${panel}]`)

  const hiding = await panelSteps(page, [
    {
      step: 'at the start',
      act: async () => {},
      expected: { sidebar: true, inspector: true, center: both },
    },
    {
      step: 'after the sidebar toggle',
      act: () => crumbsToggle('sidebar').click(),
      expected: { sidebar: false, inspector: true, center: 960 },
    },
    {
      step: 'after ]',
      act: () => page.keyboard.press(']'),
      expected: { sidebar: false, inspector: false, center: 1280 },
    },
  ])

  if (hiding) {
    return hiding
  }

  const stored = await page.evaluate((name) => localStorage.getItem(name), key)

  if (stored !== '{"sidebar":false,"inspector":false}') {
    return `${key} holds ${stored}, expected {"sidebar":false,"inspector":false}`
  }

  await page.reload()
  await page.locator('.crumbs').waitFor({ timeout: VIEWER_TIMEOUT })

  const reloaded = await panelSteps(page, [
    {
      step: 'after a reload',
      act: async () => {},
      expected: { sidebar: false, inspector: false, center: 1280 },
    },
    {
      step: 'after /',
      act: () => page.keyboard.press('/'),
      expected: { sidebar: true, inspector: false, center: 1280 - SIDEBAR.default },
    },
  ])

  if (reloaded) {
    return reloaded
  }

  const focused = await page.evaluate(() => document.activeElement?.className)

  if (focused !== 'sidebar-search') {
    return `after / the focus is on ${focused}, expected the search`
  }

  await page.locator('.module-button').first().click()
  await page.locator('.overview-head').waitFor({ timeout: VIEWER_TIMEOUT })

  return panelSteps(page, [
    {
      step: 'after the inspector toggle of an overview',
      act: () => overviewToggle('inspector').click(),
      expected: { sidebar: true, inspector: true, center: both },
    },
    {
      step: 'after [ in an overview',
      act: () => page.keyboard.press('['),
      expected: { sidebar: false, inspector: true, center: 960 },
    },
  ])
}

/** A window that the reader never toggled panels in: 1000 and 700 px, then wider again. */
async function panelWindowSteps(browser, url, test) {
  const cases = [
    { width: 1000, sidebar: true, inspector: false, center: 1000 - SIDEBAR.default },
    { width: 700, sidebar: false, inspector: false, center: 700 },
  ]

  for (const { width, ...expected } of cases) {
    const { context, page, failures } = await openLivePage(browser, url)

    try {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(test)
      await page.locator('.crumbs').waitFor({ timeout: VIEWER_TIMEOUT })

      let problem = await showsPanels(page, `at ${width} px`, expected)

      if (!problem && width === 700) {
        await page.setViewportSize({ width: 1280, height: 800 })
        problem = await showsPanels(page, 'from 700 px widened to 1280 px', {
          sidebar: true,
          inspector: true,
          center: 1280 - SIDEBAR.default - 320,
        })
      }

      const problems = [problem, ...failures].filter((entry) => entry !== null)

      if (problems.length > 0) {
        return problems.join('; ')
      }
    } finally {
      await context.close()
    }
  }

  return null
}

/** The panel toggles and `[` `]` in react-browser, and the window's defaults, in contexts of their own. */
async function checkSidePanels(browser, url) {
  const label = 'panels'
  const { context, page, failures } = await openLivePage(browser, url)
  const key = `describe-me:panels:${readSiteManifest('react-browser').root}`
  const test = `${url}examples/react-browser/#test=${testIdOf('react-browser', 'Counter > increments')}&frame=1`

  try {
    await page.goto(test)
    await page.locator('.tree .test').first().waitFor({ timeout: VIEWER_TIMEOUT })
    await page.locator(RECORDED_IFRAME).waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

    const problem =
      (await panelToggleSteps(page, key)) ?? (await panelWindowSteps(browser, url, test))

    const problems = [problem, ...failures].filter((entry) => entry !== null)

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      'check-site: the panel toggles and [ ] hide and show the sidebar and the inspector in a test and in an overview of examples/react-browser/, keep that after a reload, / shows the sidebar, and a window of 1000 px starts without the inspector, one of 700 px without either and widened to 1280 px shows both',
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

// Chromium may composite a see-through frame on its own layer or straight onto
// the canvas, and the antialiased edges of the two differ by 1 in a channel. A
// theme that reaches the frame changes its colors by far more.
const COMPOSITING_NOISE = 2

/**
 * The largest difference in one color channel between two PNG screenshots,
 * given in base64, read in the page. `null` when their sizes differ.
 */
async function largestChannelDelta([first, second]) {
  async function pixels(base64) {
    const response = await fetch(`data:image/png;base64,${base64}`)
    const bitmap = await createImageBitmap(await response.blob(), {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    })

    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')

    context.drawImage(bitmap, 0, 0)

    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  }

  const [one, two] = await Promise.all([pixels(first), pixels(second)])

  if (one.width !== two.width || one.height !== two.height) {
    return null
  }

  let largest = 0

  for (let i = 0; i < one.data.length; i++) {
    largest = Math.max(largest, Math.abs(one.data[i] - two.data[i]))
  }

  return largest
}

/**
 * Where two PNG screenshots of the stage, given in base64, differ by more than
 * `noise` in a channel: the box of those pixels, how many there are, and the
 * colors at the one that changed most. Read in the page, for a problem's message.
 */
async function changedPixels([first, second, noise]) {
  async function pixels(base64) {
    const response = await fetch(`data:image/png;base64,${base64}`)
    const bitmap = await createImageBitmap(await response.blob(), {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    })

    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')

    context.drawImage(bitmap, 0, 0)

    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  }

  const [one, two] = await Promise.all([pixels(first), pixels(second)])
  const box = { left: Infinity, top: Infinity, right: -1, bottom: -1 }
  let count = 0
  let most = { delta: 0, at: null }

  for (let i = 0; i < one.data.length; i += 4) {
    const delta = Math.max(
      ...[0, 1, 2].map((channel) => Math.abs(one.data[i + channel] - two.data[i + channel])),
    )

    if (delta <= noise) {
      continue
    }

    const left = (i / 4) % one.width
    const top = Math.floor(i / 4 / one.width)

    count += 1
    box.left = Math.min(box.left, left)
    box.top = Math.min(box.top, top)
    box.right = Math.max(box.right, left)
    box.bottom = Math.max(box.bottom, top)

    if (delta > most.delta) {
      most = { delta, at: [left, top] }
    }
  }

  const colorAt = (image, [left, top]) => {
    const start = (top * image.width + left) * 4

    return `rgb(${[...image.data.slice(start, start + 3)].join(', ')})`
  }

  return {
    box: [box.left, box.top, box.right, box.bottom],
    count,
    at: most.at,
    before: most.at && colorAt(one, most.at),
    after: most.at && colorAt(two, most.at),
  }
}

/**
 * What lies at a point of the stage's screenshot: the viewer's elements there,
 * the frame's under its iframe, and what has the pointer and the focus.
 */
function elementsAt([left, top]) {
  const stage = document.querySelector('.stage').getBoundingClientRect()
  const pageLeft = stage.left + left + 0.5
  const pageTop = stage.top + top + 0.5
  const nameOf = (element) => {
    const classes = typeof element.className === 'string' ? element.className.trim() : ''

    return `${element.tagName.toLowerCase()}${classes ? `.${classes.split(/\s+/).join('.')}` : ''}`
  }

  const stack = document.elementsFromPoint(pageLeft, pageTop)
  const iframe = stack.find((element) => element.tagName === 'IFRAME')
  const frameBox = iframe?.getBoundingClientRect()
  const frame = iframe?.contentDocument
    ? iframe.contentDocument.elementsFromPoint(pageLeft - frameBox.left, pageTop - frameBox.top)
    : []

  return {
    viewer: stack.slice(0, 5).map(nameOf),
    frame: frame.slice(0, 5).map(nameOf),
    hover: [...document.querySelectorAll(':hover')].slice(-3).map(nameOf),
    focus: document.activeElement ? nameOf(document.activeElement) : null,
  }
}

// How many times settledShot() looks again before it takes what it has.
const SETTLE_SHOTS = 10

/**
 * A shot of the stage once two in a row, SETTLE_MS apart, agree. A switch may
 * still be settling: the dark variant loads, or the live page reports the
 * background its dark media rule gives, as Material UI's does.
 */
async function settledShot(page) {
  let shot = await stageShot(page)

  for (let i = 0; i < SETTLE_SHOTS; i++) {
    await page.waitForTimeout(SETTLE_MS)

    const next = await stageShot(page)
    const delta = await page.evaluate(
      largestChannelDelta,
      [shot, next].map((buffer) => buffer.toString('base64')),
    )

    if (delta !== null && delta <= COMPOSITING_NOISE) {
      return next
    }

    shot = next
  }

  return shot
}

/** Remembers whether `data-theme` first changed while the parser had not reached `<body>`. */
function watchThemeAttribute() {
  const observer = new MutationObserver(() => {
    window.themeBeforeBody = document.body === null
    observer.disconnect()
  })

  observer.observe(document, { subtree: true, attributeFilter: ['data-theme'] })
}

/**
 * Under `light`, `dark` and `transparent` the dark theme changes neither the
 * link nor a pixel of the stage at `selector`. Ends under `system`.
 */
async function fixedBackgroundSteps(page, selector) {
  for (const value of ['light', 'dark', 'transparent']) {
    await pickBackground(page, value)

    const before =
      (await showsTheme(page, 'system')) ?? (await showsBackground(page, selector, value))

    if (before) {
      return `with ${value}: ${before}`
    }

    const shot = await settledShot(page)
    const link = page.url()

    await pickTheme(page, 'dark')

    const after = (await showsTheme(page, 'dark')) ?? (await showsBackground(page, selector, value))

    if (after) {
      return `with ${value}: ${after}`
    }

    if (page.url() !== link) {
      return `with ${value} the dark theme changed the link from ${link} to ${page.url()}`
    }

    const shots = [shot, await settledShot(page)].map((buffer) => buffer.toString('base64'))
    const delta = await page.evaluate(largestChannelDelta, shots)

    if (delta === null) {
      return `with ${value} the dark theme changed the size of the stage`
    }

    if (delta > COMPOSITING_NOISE) {
      const changed = await page.evaluate(changedPixels, [...shots, COMPOSITING_NOISE])
      const under = changed.at ? await page.evaluate(elementsAt, changed.at) : null

      return `with ${value} the dark theme changed the pixels of the stage, by up to ${delta} in a channel: ${JSON.stringify({ ...changed, under })}`
    }

    await pickTheme(page, 'system')
  }

  return null
}

/**
 * Under `auto` the dark theme gives the frame at `selector` the dark canvas
 * and scheme, and `light` and `system`, which is light here, the light ones.
 * `check` runs after each theme. Ends under `system`.
 */
async function autoThemeSteps(page, selector, check = async () => null) {
  await pickBackground(page, 'auto')

  for (const theme of ['dark', 'light', 'system']) {
    await pickTheme(page, theme)

    const resolved = theme === 'dark' ? 'dark' : 'light'
    const problem =
      (await showsTheme(page, theme)) ??
      (await showsBackground(page, selector, 'auto', resolved)) ??
      (await check(theme))

    if (problem) {
      return `with auto: ${problem}`
    }
  }

  return null
}

/**
 * In a replayed frame: the theme changes nothing under `light`, `dark` and
 * `transparent`, and picks the canvas and the scheme under `auto`. The dark
 * theme survives a reload, and under it every value of the switch shows no
 * backdrop. Ends under `auto` and `system`.
 */
async function replayThemeSteps(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}&live=0`)
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  const start =
    (await showsTheme(page, 'system')) ?? (await showsBackground(page, RECORDED_IFRAME, 'auto'))

  if (start) {
    return start
  }

  const problem =
    (await fixedBackgroundSteps(page, RECORDED_IFRAME)) ??
    (await autoThemeSteps(page, RECORDED_IFRAME))

  if (problem) {
    return problem
  }

  await pickTheme(page, 'dark')
  await page.reload()
  await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

  if ((await page.evaluate(() => window.themeBeforeBody)) !== true) {
    return 'after a reload data-theme was not set before <body>'
  }

  const reloaded =
    (await showsTheme(page, 'dark')) ??
    (await showsBackground(page, RECORDED_IFRAME, 'auto', 'dark'))

  if (reloaded) {
    return `after a reload: ${reloaded}`
  }

  await seeThrough(page, RECORDED_IFRAME)

  const seen = await eachBackground(page, RECORDED_IFRAME, async () => null, 'dark')

  if (seen) {
    return `under the dark theme: ${seen}`
  }

  await pickBackground(page, 'auto')
  await pickTheme(page, 'system')

  return showsTheme(page, 'system')
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

/**
 * In Live: under `auto` the theme picks the canvas and the scheme, and under
 * `light`, `dark` and `transparent` it changes nothing. The live frame never
 * reloads. Ends under `auto` and `system`.
 */
async function liveThemeSteps(page, url, name, id) {
  await page.goto(`${url}examples/${name}/#test=${id}`)
  await page
    .locator('.live-toggle[aria-pressed="true"]')
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })

  await mountedInLive(page)
  await page.locator(LIVE_IFRAME).evaluate((iframe) => {
    iframe.contentWindow.viewerThemeMarker = true
  })

  const reloaded = async (theme) => {
    const kept = await page
      .locator(LIVE_IFRAME)
      .evaluate((iframe) => iframe.contentWindow.viewerThemeMarker === true)

    return kept ? null : `under the ${theme} theme the live frame reloaded`
  }

  const problem =
    (await autoThemeSteps(page, LIVE_IFRAME, reloaded)) ??
    (await fixedBackgroundSteps(page, LIVE_IFRAME)) ??
    (await reloaded('system'))

  if (problem) {
    return `Live: ${problem}`
  }

  await pickBackground(page, 'auto')
  await pickTheme(page, 'system')

  return showsTheme(page, 'system')
}

/** Every frame assertion of the theme, with the emulation off so frames take their own scheme. */
async function frameThemeSteps(browser, url, name) {
  const { context, page, failures } = await openLivePage(browser, url)
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

/** Waits until `.stage` has `data-canvas="${canvas}"`. Returns a problem or `null`. */
async function showsDataCanvas(page, canvas) {
  const shown = await page
    .locator(`.stage[data-canvas="${canvas}"]`)
    .waitFor({ state: 'attached', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (shown) {
    return null
  }

  const seen = await page.evaluate(() => document.querySelector('.stage')?.dataset.canvas ?? null)

  return `the stage has data-canvas="${seen}", expected ${canvas}`
}

/**
 * On a dark system, `system` is dark, so is `auto` on a replayed frame, and
 * a stored `light` survives a reload. The emulation forces the scheme into
 * every frame, so only the chrome and the stage's `data-canvas` count.
 */
async function darkSystemThemeSteps(browser, url, name) {
  const { context, page, failures } = await openLivePage(browser, url, 'dark')
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    await page.goto(`${url}examples/${name}/`)
    await showsTree(page)

    let problem = await showsTheme(page, 'system', { background: DARK_BACKGROUND })

    if (!problem) {
      await page.goto(`${url}examples/${name}/#test=${id}&live=0`)
      await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

      const canvas = await showsDataCanvas(page, 'dark')

      problem = canvas ? `under system and auto: ${canvas}` : null
    }

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

/**
 * With the emulation off, a system that turns dark under `system` and `auto`
 * turns the stage's canvas dark without a reload. The emulation then forces
 * the scheme into every frame, so only `data-canvas` counts.
 */
async function systemSwitchSteps(browser, url, name) {
  const { context, page, failures } = await openLivePage(browser, url)
  const id = testIdOf(name, LIVE_TESTS[name].fullName)

  try {
    await page.goto(`${url}examples/${name}/#test=${id}&live=0`)
    await page.locator(RECORDED_IFRAME).waitFor({ timeout: VIEWER_TIMEOUT })

    let problem = await showsDataCanvas(page, 'light')

    if (!problem) {
      await page.evaluate(() => {
        window.systemSwitchMarker = true
      })

      await page.emulateMedia({ colorScheme: 'dark' })
      problem = await showsDataCanvas(page, 'dark')
    }

    if (!problem && (await page.evaluate(() => window.systemSwitchMarker)) !== true) {
      problem = 'the viewer reloaded'
    }

    return [problem, ...failures]
      .filter((entry) => entry !== null)
      .map((entry) => `when the system turns dark under system and auto: ${entry}`)
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
  const { context, page, failures } = await openLivePage(browser, url)
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

/**
 * The viewer's own theme: stored and set before the body. Under `auto` it
 * picks the canvas and the frames' scheme, and otherwise no frame sees it.
 */
async function checkViewerTheme(browser, url, name) {
  const label = `examples/${name}/ viewer theme`

  try {
    const problems = [
      ...(await frameThemeSteps(browser, url, name)),
      ...(await darkSystemThemeSteps(browser, url, name)),
      ...(await systemSwitchSteps(browser, url, name)),
      ...(await blockedThemeSteps(browser, url, name)),
    ]

    if (problems.length > 0) {
      return problems.map((entry) => `${label}: ${entry}`)
    }

    console.log(
      `check-site: examples/${name}/ viewer theme survives a reload, is set before the body, keeps the focus and works without storage, under auto picks the canvas and the frames' color scheme and follows a change of the system's scheme without a reload, and under light, dark and transparent changes no pixel of the stage, in replay and in Live`,
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

const scanned = machinePathsIn(SITE, { 'the checkout': repoRoot })

if (scanned.problems.length === 0) {
  console.log(
    `check-site: no file of site/ names the checkout or the home directory (${scanned.files} files)`,
  )
}

const { server, url } = await serveStatic(SITE)
let browser = null
let problems = [...scanned.problems]

try {
  browser = await launchChromium()

  // With the emulation off, as everywhere here, headless Chromium's scheme is light.
  const context = await browser.newContext({ colorScheme: null })

  problems.push(...(await checkPages(context, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkViewer(context, url, name)))
  }

  problems.push(...(await checkTags(context, url)))
  problems.push(...(await checkLongProps(context, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkGalleries(context, url, name)))
  }

  for (const name of exampleNames) {
    problems.push(...(await checkLive(browser, url, name)))
  }

  problems.push(...(await checkLiveByDefault(browser, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkStageBackground(browser, url, name)))
  }

  problems.push(...(await checkStageDarkVariant(browser, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkLiveLoading(browser, url, name)))
  }

  problems.push(...(await checkLiveLoadingReducedMotion(browser, url)))
  problems.push(...(await checkSidebarWidth(browser, url)))
  problems.push(...(await checkSidePanels(browser, url)))

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
  `check-site: ok — no file names the checkout or the home directory, docs.css applies, ${exampleNames.length} viewers load their tests, filter by a tag, fold long props tables, paint every gallery of an overview, mount one in Live, open a test in Live by default, show Live loading, set the stage background, its page color, its note and its dark variant, keep a resized sidebar per project, hide and show the side panels and let the viewer theme pick the stage only under auto`,
)
