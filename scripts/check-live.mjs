/**
 * Checks the live preview of both examples in headless Chromium. For each
 * example it starts `createLiveServer()` from `@describe-me/vitest/live` on
 * the config file its manifest names, frames the live page from a host page
 * on another origin, and shows every test of the manifest: each one must
 * report `mounted`, then a positive height, load the frame exactly once and
 * log no error. Six behaviours of live components follow: an action from a
 * `vi.fn()`, two rerenders from an empty fragment, a toast that hides itself
 * in real time, an async load, and a theme with global styles. Eight pages
 * must report their status: `no-render` for a hook, `import-failed` for a
 * missing file, and `not-found` for a missing test, a path out of the root,
 * three `file` values that would lead to another origin and an occurrence
 * past a test's last one. Then each example's viewer runs through
 * `describe-me dev`, one at a time, because two viewers race on the viewer's
 * Vite cache. `__live.json` must say `ready` with the preview's base. In
 * react-browser, `L` mounts `Menu > selects an item and reports it` in a live
 * frame without a sandbox, an action shows in the inspector, the 375px
 * preset keeps the state without a reload, a notice and an error from the
 * frame show while the same message from the viewer page does not, Restart
 * starts fresh and ← leaves Live for a recorded frame. A link with `live=1`
 * opens Live in both examples, which proves that the CLI finds the project
 * from the jsdom manifest too. `describe-me dev --no-live` answers off and
 * shows no toggle. The viewer pages log no error. Last, the live fixtures of
 * both examples run under Vitest and in the live preview, with setup files,
 * fixtures, around hooks, `each` and `for` names, module mocks, a Node-only
 * import, `setup-failed` and `live: false` (scripts/check-live/check-fixtures.mjs).
 * Remote requests are answered locally, so remote fonts never decide the
 * result. Run after `pnpm build` and both examples' tests.
 *
 * Usage: `node scripts/check-live.mjs`
 */
import { join } from 'node:path'
import { checkFixtures, FIXTURE_ENV } from './check-live/check-fixtures.mjs'
import {
  checkLiveOffViewer,
  openViewer,
  startDev,
  stopDev,
  waitForPreview,
} from './check-live/dev-server.mjs'
import {
  BASE,
  checkMount,
  checkQuiet,
  delay,
  errorMessage,
  expectVisible,
  FIRST_STATUS_TIMEOUT,
  importCreateLiveServer,
  LIVE_ENV,
  LIVE_SOURCE,
  manifestTests,
  openHost,
  readManifest,
  show,
  STATUS_TIMEOUT,
  startHost,
  waitForMessage,
} from './check-live/live-frame.mjs'
import { exampleNames } from './docs/example-names.mjs'
import { launchChromium } from './docs/launch-chromium.mjs'
import { repoRoot } from './docs/repo-root.mjs'

// `ink` of examples/react-jsdom/src/theme.ts.
const THEME_INK = 'rgb(17, 17, 17)'
// `mounted` in packages/viewer/src/live-status-words.ts.
const MOUNTED_WORDS = 'mounted as the test arranged it'

/** The test each example's viewer mounts live. */
const VIEWER_TESTS = {
  'react-browser': 'Menu > selects an item and reports it',
  'react-jsdom': 'Heading > takes its colour from the theme',
}

async function selectsRename({ page, frame }) {
  await frame.getByRole('button', { name: 'Actions' }).click()
  await frame.getByRole('menuitem', { name: 'Rename' }).click()

  const action = await waitForMessage(page, (message) => message.type === 'action', 5_000)
  const shown = JSON.stringify(action && { name: action.name, args: action.args })
  const expected = JSON.stringify({ name: 'onSelect', args: ['"Rename"'] })
  const problems = shown === expected ? [] : [`expected the action ${expected}, got ${shown}`]

  return [
    ...problems,
    ...(await expectVisible(frame.getByText('selected: Rename'), '"selected: Rename"', 5_000)),
  ]
}

async function hidesInRealTime({ frame, mountedAt }) {
  const saved = frame.getByText('Saved')
  const shown = await expectVisible(saved, '"Saved"', 2_000)

  if (shown.length > 0) {
    return shown
  }

  await delay(Math.max(0, mountedAt + 2_000 - Date.now()))

  if (!(await saved.isVisible())) {
    return ['"Saved" was gone before 2 s, so time is not real or the timer is too short']
  }

  try {
    await saved.waitFor({ state: 'hidden', timeout: Math.max(1, mountedAt + 5_000 - Date.now()) })

    return []
  } catch {
    return ['"Saved" was still there 5 s after the mount']
  }
}

async function takesTheTheme({ frame }) {
  const heading = frame.locator('h2')
  const shown = await expectVisible(heading, 'the heading', 5_000)

  if (shown.length > 0) {
    return shown
  }

  const globalStyles = await frame
    .locator('body')
    .evaluate((body) => getComputedStyle(body).getPropertyValue('--global-styles').trim())

  const colour = await heading.evaluate((element) => getComputedStyle(element).color)
  const problems = []

  if (globalStyles !== 'applied') {
    problems.push(`body has --global-styles: ${JSON.stringify(globalStyles)}, expected "applied"`)
  }

  if (colour !== THEME_INK) {
    problems.push(`the h2 colour is ${colour}, expected ${THEME_INK} from the theme`)
  }

  return problems
}

/** What a live component must do after it mounted, by example and full test name. */
const BEHAVIOURS = {
  'react-browser': {
    'Menu > selects an item and reports it': selectsRename,
    'Naming > names Button variant=ghost after a rerender from an empty fragment': ({ frame }) =>
      expectVisible(frame.getByRole('button', { name: 'Skip for now' }), '"Skip for now"', 5_000),
  },
  'react-jsdom': {
    'Naming > names Badge tone=danger after a rerender from an empty fragment': ({ frame }) =>
      expectVisible(frame.getByText('blocked'), '"blocked"', 5_000),
    'Toast > hides itself after its duration': hidesInRealTime,
    'AsyncGreeting > greets once loaded': ({ frame }) =>
      expectVisible(frame.getByText('Hello, Ada'), '"Hello, Ada"', 5_000),
    'Heading > takes its colour from the theme': takesTheTheme,
  },
}

const USED = ['Menu', 'selects an item and reports it']

// The URL parser drops tabs and newlines, so each of these would become `//other.test/x.js`.
const OTHER_ORIGIN = ['\t', '\n', '\r'].map((control) => ({
  file: `${control}/other.test/x.js`,
  path: USED,
  status: 'not-found',
}))

/** Pages that must report a status other than `mounted`, and show it in `body`. */
const STATUSES = {
  'react-browser': [
    { file: 'src/Menu.test.tsx', path: ['Menu', 'no such test'], status: 'not-found' },
    { file: '../src/Menu.test.tsx', path: USED, status: 'not-found' },
    { file: 'src/missing.test.tsx', path: USED, status: 'import-failed' },
    ...OTHER_ORIGIN,
  ],
  'react-jsdom': [
    {
      file: 'src/use-toggle.test.tsx',
      path: ['useToggle', 'flips its value'],
      status: 'no-render',
    },
    // plugin-react adds a self-import to a file with a component. A second copy of the
    // file would register this test twice, and its second occurrence would mount.
    {
      file: 'src/Naming.test.tsx',
      path: ['Naming', 'names Badge tone=danger inside a ThemeProvider'],
      occurrence: 2,
      status: 'not-found',
    },
  ],
}

async function checkStatus(context, expected) {
  const label = `${context.name} file=${JSON.stringify(expected.file)}`
  const status = await show(context, expected, STATUS_TIMEOUT)

  if (status?.status !== expected.status) {
    return [`${label}: expected ${expected.status}, got ${status?.status ?? 'no status'}`]
  }

  const text = await context.frame.locator('body').innerText()

  return text.includes(expected.status)
    ? []
    : [`${label}: the page does not show ${expected.status}`]
}

/** The server's contract: its base URL, its protocol, and the flag gone again. */
function checkServer(name, server) {
  const problems = []

  if (!BASE.test(server.base)) {
    problems.push(
      `${name}: base is ${server.base}, expected http://localhost:<port>/__describe-me/`,
    )
  }

  if (server.protocol !== 1) {
    problems.push(`${name}: protocol is ${server.protocol}, expected 1`)
  }

  if (process.env[LIVE_ENV] !== undefined) {
    problems.push(`${name}: ${LIVE_ENV} is still set after createLiveServer()`)
  }

  return problems
}

/** Shows every test of the manifest, then runs the behaviour of those that have one. */
async function checkTests(context, manifest) {
  const result = { problems: [], mounted: 0, behaviours: 0 }

  for (const [index, test] of manifestTests(manifest).entries()) {
    const label = `${context.name} ${test.file} ${test.fullName}`
    const timeout = index === 0 ? FIRST_STATUS_TIMEOUT : STATUS_TIMEOUT
    const mount = await checkMount(context, test, timeout)
    const behaviour = BEHAVIOURS[context.name]?.[test.fullName]

    result.problems.push(...mount.problems)

    if (mount.problems.length === 0) {
      result.mounted += 1
    }

    if (behaviour !== undefined && mount.problems.length === 0) {
      const behaved = await behaviour({ ...context, mountedAt: mount.mountedAt })

      result.problems.push(...behaved.map((problem) => `${label}: ${problem}`))
      result.behaviours += behaved.length === 0 ? 1 : 0
    }

    result.problems.push(...(await checkQuiet(context, label)))
  }

  return result
}

/** Shows each page that must report a status other than `mounted`. */
async function checkStatuses(context) {
  const result = { problems: [], passed: 0 }

  for (const expected of STATUSES[context.name] ?? []) {
    const problems = await checkStatus(context, expected)

    result.problems.push(...problems)
    result.passed += problems.length === 0 ? 1 : 0
  }

  return result
}

async function checkExample(browser, host, name) {
  const root = join(repoRoot, 'examples', name)
  const manifest = readManifest(root, name)
  const total = manifestTests(manifest).length

  if (manifest.configFile !== 'vitest.config.ts') {
    return {
      problems: [
        `${name}: the manifest's configFile is ${manifest.configFile}, expected vitest.config.ts`,
      ],
    }
  }

  const createLiveServer = await importCreateLiveServer(root)
  const server = await createLiveServer({ root, configFile: manifest.configFile })
  const context = await openHost(browser, host, name, server.base)

  try {
    const tests = await checkTests(context, manifest)
    const statuses = await checkStatuses(context)

    return {
      problems: [...checkServer(name, server), ...tests.problems, ...statuses.problems],
      summary: `${name} ${tests.mounted}/${total}`,
      behaviours: tests.behaviours,
      statuses: statuses.passed,
    }
  } finally {
    await context.close()
    await server.close()
  }
}

function testIdOf(manifest, fullName) {
  const test = manifest.modules
    .flatMap((module) => module.tests)
    .find((candidate) => candidate.fullName === fullName)

  if (!test) {
    throw new Error(`the manifest has no test "${fullName}"`)
  }

  return test.id
}

function linkParams(page) {
  return new URLSearchParams(new URL(page.url()).hash.slice(1))
}

/** The page of the live iframe on the stage, to act in it like a user would. */
async function liveFrameOf(page) {
  const handle = await page.locator('.stage-slot.live-slot iframe').elementHandle()
  const frame = await handle?.contentFrame()

  if (!frame) {
    throw new Error('the live iframe has no page')
  }

  return frame
}

async function expectMounted(page, timeout) {
  try {
    await page
      .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
      .waitFor({ state: 'visible', timeout })

    return []
  } catch {
    const shown = await page
      .locator('.live-section')
      .innerText()
      .catch(() => 'no live section')

    return [`the inspector did not say "${MOUNTED_WORDS}" within ${timeout / 1000} s: ${shown}`]
  }
}

/** The live slot's iframe: no sandbox, and the live page of the preview as its source. */
async function checkLiveIframe(page, base) {
  const iframe = page.locator('.stage-slot.live-slot iframe')

  await iframe.waitFor({ state: 'attached', timeout: 5_000 })

  const sandbox = await iframe.getAttribute('sandbox')
  const src = new URL(await iframe.getAttribute('src'))
  const problems = []

  src.search = ''

  if (sandbox !== null) {
    problems.push(`the live iframe has sandbox="${sandbox}"`)
  }

  if (src.href !== new URL('live.html', base).href) {
    problems.push(`the live iframe loads ${src.href}, expected ${base}live.html`)
  }

  return problems
}

async function pressLive(context) {
  const { page } = context

  await page.locator('.live-toggle:not([aria-disabled])').waitFor({ state: 'visible' })
  await page.keyboard.press('l')

  const problems = await checkLiveIframe(page, context.base)

  if (linkParams(page).get('live') !== '1') {
    problems.push(`the link has no live=1: ${page.url()}`)
  }

  return [...problems, ...(await expectMounted(page, FIRST_STATUS_TIMEOUT))]
}

async function selectsRenameLive({ page }) {
  const frame = await liveFrameOf(page)

  await frame.getByRole('button', { name: 'Actions' }).click()
  await frame.getByRole('menuitem', { name: 'Rename' }).click()

  return expectVisible(
    page.locator('.live-actions li', { hasText: 'onSelect("Rename")' }),
    'onSelect("Rename") in .live-actions',
    5_000,
  )
}

async function keepsStateAt375({ page, viewer }) {
  await page.locator('.crumbs .tools button', { hasText: '375px' }).click()

  const iframe = page.locator('.stage-slot.live-slot iframe')
  const problems = []

  try {
    await page.waitForFunction(
      () => document.querySelector('.live-slot iframe')?.getBoundingClientRect().width === 375,
      null,
      { timeout: 5_000 },
    )
  } catch {
    const width = await iframe.evaluate((element) => element.getBoundingClientRect().width)

    problems.push(`the live iframe is ${width} px wide, expected 375`)
  }

  const frame = await liveFrameOf(page)

  problems.push(
    ...(await expectVisible(frame.getByText('selected: Rename'), '"selected: Rename"', 2_000)),
  )

  if (viewer.loads !== 1) {
    problems.push(`the live frame loaded ${viewer.loads} times, expected once`)
  }

  return problems
}

/** Only the live frame on the stage may talk to the viewer, never the viewer page itself. */
async function showsWhatTheFramePosts({ page, viewerOrigin }) {
  const frame = await liveFrameOf(page)

  await frame.evaluate(
    ({ origin, source }) => {
      window.parent.postMessage({ source, type: 'notice', message: 'check-live notice' }, origin)
      window.parent.postMessage({ source, type: 'error', message: 'check-live error' }, origin)
    },
    { origin: viewerOrigin, source: LIVE_SOURCE },
  )

  const problems = [
    ...(await expectVisible(
      page.locator('.live-section .live-notice', { hasText: 'check-live notice' }),
      'the notice in the inspector',
      5_000,
    )),
    ...(await expectVisible(
      page.locator('.live-section pre.err', { hasText: 'check-live error' }),
      'the error in the inspector',
      5_000,
    )),
  ]

  await page.evaluate(
    ({ origin, source }) => {
      window.postMessage({ source, type: 'notice', message: 'check-live forged' }, origin)
    },
    { origin: viewerOrigin, source: LIVE_SOURCE },
  )

  await delay(500)

  if ((await page.locator('.live-section', { hasText: 'check-live forged' }).count()) > 0) {
    problems.push('the inspector shows a message the viewer page posted to itself')
  }

  return problems
}

async function restartsFresh({ page, viewer }) {
  await page.locator('.live-restart').click()

  const problems = await expectMounted(page, STATUS_TIMEOUT)

  if (viewer.loads !== 2) {
    problems.push(`after Restart the live frame loaded ${viewer.loads} times, expected twice`)
  }

  if ((await page.locator('.live-actions li').count()) > 0) {
    problems.push('after Restart the inspector still lists actions')
  }

  const frame = await liveFrameOf(page)

  await frame.getByRole('button', { name: 'Actions' }).waitFor({ timeout: 5_000 })

  if ((await frame.getByText('selected: Rename').count()) > 0) {
    problems.push('after Restart the live frame still shows "selected: Rename"')
  }

  return problems
}

async function arrowLeavesLive({ page }) {
  await page.locator('.crumbs .path').click()
  await page.keyboard.press('ArrowLeft')

  const problems = []

  try {
    await page.locator('.stage-slot.live-slot').waitFor({ state: 'detached', timeout: 5_000 })
  } catch {
    problems.push('the live slot is still on the stage after ←')
  }

  if (linkParams(page).has('live')) {
    problems.push(`the link still has live after ←: ${page.url()}`)
  }

  return [
    ...problems,
    ...(await expectVisible(
      page.locator('.stage-slot[data-frame]:not(.incoming) iframe'),
      'a recorded frame on the stage',
      5_000,
    )),
  ]
}

/** A link with `live=1` in a new page: the recorded frame until the preview is ready, then Live. */
async function opensFromLink(browser, context, testId) {
  const url = `${context.url}#test=${testId}&live=1`
  const viewer = await openViewer(browser, url, new URL(context.base).origin)

  try {
    const problems = [
      ...(await expectMounted(viewer.page, FIRST_STATUS_TIMEOUT)),
      ...(await checkLiveIframe(viewer.page, context.base)),
    ]

    return [...problems, ...viewer.errors]
  } finally {
    await viewer.browserContext.close()
  }
}

/** Runs the steps in order, and stops at the first that fails, because each needs the one before. */
async function runSteps(label, steps, context) {
  const result = { problems: [], passed: 0 }

  for (const [name, step] of steps) {
    let problems

    try {
      problems = await step(context)
    } catch (error) {
      problems = [errorMessage(error)]
    }

    if (problems.length > 0) {
      result.problems.push(...problems.map((problem) => `${label}, ${name}: ${problem}`))
      break
    }

    result.passed += 1
  }

  return result
}

const BROWSER_STEPS = [
  ['L mounts the test', pressLive],
  ['an action', selectsRenameLive],
  ['375px keeps the state', keepsStateAt375],
  ['notice and error', showsWhatTheFramePosts],
  ['Restart', restartsFresh],
  ['← leaves Live', arrowLeavesLive],
]

/** Starts `describe-me dev` in an example and waits for `__live.json` to say `ready`. */
async function startReadyDev(name) {
  const dev = await startDev(join(repoRoot, 'examples', name), '.describe-me')
  const preview = await waitForPreview(dev)

  if (preview?.status !== 'ready' || !BASE.test(preview.base ?? '')) {
    await stopDev(dev)

    throw new Error(
      `describe-me dev: __live.json says ${JSON.stringify(preview)}, expected ready with http://localhost:<port>/__describe-me/. Output:\n${dev.output()}`,
    )
  }

  return { dev, base: preview.base }
}

/** Live in the example's viewer, through `describe-me dev`. */
async function checkViewer(browser, name) {
  const label = `${name} viewer`
  const manifest = readManifest(join(repoRoot, 'examples', name), name)
  const testId = testIdOf(manifest, VIEWER_TESTS[name])
  const { dev, base } = await startReadyDev(name)
  const context = { url: dev.url, base, viewerOrigin: new URL(dev.url).origin }

  try {
    if (name !== 'react-browser') {
      const problems = await opensFromLink(browser, context, testId)

      return {
        problems: problems.map((problem) => `${label}, live=1: ${problem}`),
        passed: problems.length === 0 ? 1 : 0,
      }
    }

    const viewer = await openViewer(browser, `${dev.url}#test=${testId}`, new URL(base).origin)

    try {
      const result = await runSteps(label, BROWSER_STEPS, { ...context, page: viewer.page, viewer })
      const fromLink = await opensFromLink(browser, context, testId)

      return {
        problems: [
          ...result.problems,
          ...viewer.errors.map((error) => `${label}: ${error}`),
          ...fromLink.map((problem) => `${label}, live=1: ${problem}`),
        ],
        passed: result.passed + (fromLink.length === 0 ? 1 : 0),
      }
    } finally {
      await viewer.browserContext.close()
    }
  } finally {
    await stopDev(dev)
  }
}

/** `describe-me dev --no-live`: `__live.json` says off, and the viewer shows no toggle. */
async function checkNoLive(browser) {
  const name = exampleNames[0]
  const label = `${name} viewer --no-live`
  const dev = await startDev(join(repoRoot, 'examples', name), '.describe-me', ['--no-live'])

  try {
    const problems = await checkLiveOffViewer(browser, dev)

    return {
      problems: problems.map((problem) => `${label}: ${problem}`),
      passed: problems.length === 0 ? 1 : 0,
    }
  } finally {
    await stopDev(dev)
  }
}

/** Live in both examples' viewers, then `--no-live`. A viewer that does not start fails alone. */
async function checkViewers(browser) {
  const checks = [
    ...exampleNames.map((name) => () => checkViewer(browser, name)),
    () => checkNoLive(browser),
  ]

  const total = { problems: [], passed: 0 }

  for (const check of checks) {
    try {
      const result = await check()

      total.problems.push(...result.problems)
      total.passed += result.passed
    } catch (error) {
      // The whole message, which holds the output of describe-me dev.
      total.problems.push(error instanceof Error ? error.message : String(error))
    }
  }

  return total
}

// The check expects the flags unset before and after each server starts.
delete process.env[LIVE_ENV]
delete process.env[FIXTURE_ENV]

const host = await startHost()
const summaries = []
let problems = []
let behaviours = 0
let statuses = 0
let viewerSteps = 0
let fixtures = null
let browser = null

try {
  browser = await launchChromium()

  for (const name of exampleNames) {
    const result = await checkExample(browser, host, name)

    problems.push(...result.problems)
    summaries.push(result.summary)
    behaviours += result.behaviours ?? 0
    statuses += result.statuses ?? 0
  }

  const viewers = await checkViewers(browser)

  problems.push(...viewers.problems)
  viewerSteps = viewers.passed
  fixtures = await checkFixtures(browser, host)
  problems.push(...fixtures.problems)
} catch (error) {
  problems = [...problems, errorMessage(error)]
} finally {
  await browser?.close()
  host.server.closeAllConnections()
  host.server.close()
}

for (const problem of problems) {
  console.error(`check-live: ${problem}`)
}

if (problems.length > 0) {
  process.exit(1)
}

console.log(
  `check-live: ok — ${summaries.join(', ')} mounted, ${behaviours} behaviours, ${statuses} statuses, viewer ${viewerSteps} steps, ${fixtures.summary}`,
)
