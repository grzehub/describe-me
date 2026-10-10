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
 * shows no toggle. The viewer pages log no error. Remote requests are
 * answered locally, so remote fonts never decide the result. Run after
 * `pnpm build` and both examples' tests.
 *
 * Usage: `node scripts/check-live.mjs`
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { createServer as createNetServer } from 'node:net'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { exampleNames } from './docs/example-names.mjs'
import { launchChromium } from './docs/launch-chromium.mjs'
import { repoRoot } from './docs/repo-root.mjs'

const LIVE_ENV = 'DESCRIBE_ME_LIVE'
const LIVE_SOURCE = 'describe-me-live'
const BASE = /^http:\/\/localhost:\d+\/__describe-me\/$/
const FIRST_STATUS_TIMEOUT = 30_000
const STATUS_TIMEOUT = 15_000
const SIZE_TIMEOUT = 5_000
const POLL = 50
// `ink` of examples/react-jsdom/src/theme.ts.
const THEME_INK = 'rgb(17, 17, 17)'
const DESCRIBE_ME_BIN = join(repoRoot, 'packages', 'viewer', 'bin', 'describe-me.js')
const VIEWER_READY_TIMEOUT = 60_000
// `mounted` in packages/viewer/src/live-status-words.ts.
const MOUNTED_WORDS = 'mounted as the test arranged it'
const COLOURS = new RegExp(String.raw`\u001b\[[\d;]*m`, 'g')

/** The test each example's viewer mounts live. */
const VIEWER_TESTS = {
  'react-browser': 'Menu > selects an item and reports it',
  'react-jsdom': 'Heading > takes its colour from the theme',
}

// The host page keeps every message from the live frame, with the time it came.
const HOST_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="icon" href="data:,">
    <title>check-live host</title>
  </head>
  <body>
    <iframe id="live" title="live preview" width="800" height="600"></iframe>
    <script>
      window.liveOrigin = null
      window.liveMessages = []
      window.addEventListener('message', (event) => {
        const frame = document.getElementById('live')

        if (event.origin === window.liveOrigin && event.source === frame.contentWindow) {
          window.liveMessages.push({ data: event.data, at: Date.now() })
        }
      })
    </script>
  </body>
</html>
`

function errorMessage(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The page that frames the live page, on 127.0.0.1, another origin than the live server's localhost. */
function startHost() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(HOST_PAGE)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })
    })
  })
}

function readManifest(root, name) {
  const file = join(root, '.describe-me', 'manifest.json')

  if (!existsSync(file)) {
    throw new Error(`examples/${name} has no .describe-me/manifest.json. Run its tests first`)
  }

  return JSON.parse(readFileSync(file, 'utf8'))
}

/** `createLiveServer` as the example resolves it, so the check runs what a project installs. */
async function importCreateLiveServer(root) {
  const entry = createRequire(join(root, 'package.json')).resolve('@describe-me/vitest/live')
  const { createLiveServer } = await import(pathToFileURL(entry).href)

  return createLiveServer
}

/** Every test of the manifest, in module and test order, with its occurrence in the module. */
function manifestTests(manifest) {
  return manifest.modules.flatMap((module) => {
    const seen = new Map()

    return module.tests.map((test) => {
      const path = [...test.path, test.name]
      const key = JSON.stringify(path)
      const occurrence = (seen.get(key) ?? 0) + 1

      seen.set(key, occurrence)

      return { file: module.id, path, occurrence, fullName: test.fullName }
    })
  })
}

function pageUrl(base, hostOrigin, { file, path, occurrence = 1 }) {
  const query = new URLSearchParams({
    file,
    path: JSON.stringify(path),
    occurrence: String(occurrence),
    origin: hostOrigin,
  })

  return `${base}live.html?${query}`
}

/** What the live frame posted so far, without the `source` field, each with the host's time. */
async function liveMessages(page) {
  const kept = await page.evaluate(() => window.liveMessages)

  return kept
    .filter((message) => message.data?.source === LIVE_SOURCE)
    .map((message) => ({ ...message.data, at: message.at }))
}

async function waitForMessage(page, matches, timeout) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const found = (await liveMessages(page)).find(matches)

    if (found) {
      return found
    }

    await delay(POLL)
  }

  return null
}

/**
 * Counts the loads of the live frame and the errors it logs, so each test can
 * be held to one load and no error while it was shown.
 */
function watchFrame(page, liveOrigin) {
  const watch = { loads: 0, errors: [] }

  const isLive = (frame) => {
    try {
      return new URL(frame.url()).origin === liveOrigin
    } catch {
      return false
    }
  }

  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame() && isLive(frame)) {
      watch.loads += 1
    }
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      watch.errors.push(`console: ${message.text()}`)
    }
  })

  page.on('pageerror', (error) => watch.errors.push(`page error: ${errorMessage(error)}`))

  return watch
}

/** Points the frame at a page, and waits for its status. */
async function show(context, target, timeout) {
  const { page, watch } = context

  watch.loads = 0
  watch.errors = []

  await page.evaluate(
    (src) => {
      window.liveMessages = []
      document.getElementById('live').src = src
    },
    pageUrl(context.base, context.hostOrigin, target),
  )

  return waitForMessage(page, (message) => message.type === 'status', timeout)
}

/** Shows one test of the manifest, and checks that it mounts cleanly. */
async function checkMount(context, test, timeout) {
  const label = `${context.name} ${test.file} ${test.fullName}`
  const status = await show(context, test, timeout)

  if (status === null) {
    return { problems: [`${label}: no status within ${timeout / 1000} s`] }
  }

  if (status.status !== 'mounted') {
    const detail = status.detail ? `: ${status.detail.split('\n')[0]}` : ''

    return { problems: [`${label}: ${status.status}${detail}`] }
  }

  const size = await waitForMessage(
    context.page,
    (message) => message.type === 'size' && message.height > 0,
    SIZE_TIMEOUT,
  )

  const problems = []

  if (size === null || size.at - status.at > SIZE_TIMEOUT) {
    problems.push(`${label}: no size with a positive height within ${SIZE_TIMEOUT / 1000} s`)
  }

  return { problems, mountedAt: status.at }
}

/** What happened while the test was shown, beyond its status: loads and errors. */
async function checkQuiet(context, label) {
  const errors = (await liveMessages(context.page))
    .filter((message) => message.type === 'error')
    .map((message) => `live error: ${message.message}`)

  const problems = [...context.watch.errors, ...errors].map((error) => `${label}: ${error}`)

  if (context.watch.loads !== 1) {
    problems.push(
      `${label}: the live frame loaded ${context.watch.loads} times, expected once. Did Vite find a dependency late?`,
    )
  }

  return problems
}

async function expectVisible(locator, what, timeout) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout })

    return []
  } catch {
    return [`${what} did not show within ${timeout / 1000} s`]
  }
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
  const browserContext = await browser.newContext()

  try {
    // Remote fonts and stylesheets of the preview head never decide the result, offline or not.
    await browserContext.route(
      (url) => url.protocol === 'https:',
      (route) => {
        const type = route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/plain'

        return route.fulfill({ status: 200, contentType: type, body: '' })
      },
    )

    const page = await browserContext.newPage()
    const liveOrigin = new URL(server.base).origin

    await page.goto(host.url)
    await page.evaluate((origin) => {
      window.liveOrigin = origin
    }, liveOrigin)

    const context = {
      name,
      page,
      frame: page.frameLocator('#live'),
      base: server.base,
      hostOrigin: new URL(host.url).origin,
      watch: watchFrame(page, liveOrigin),
    }

    const tests = await checkTests(context, manifest)
    const statuses = await checkStatuses(context)

    return {
      problems: [...checkServer(name, server), ...tests.problems, ...statuses.problems],
      summary: `${name} ${tests.mounted}/${total}`,
      behaviours: tests.behaviours,
      statuses: statuses.passed,
    }
  } finally {
    await browserContext.close()
    await server.close()
  }
}

/** A port on localhost that nothing listens on right now. */
function freePort() {
  const server = createNetServer()

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, 'localhost', () => {
      const { port } = server.address()

      server.close(() => resolve(port))
    })
  })
}

/**
 * Starts `describe-me dev` in an example, without a shell. Vite closes its
 * dev server when stdin ends, unless `CI` is exactly `true`, so stdin stays
 * piped and open. The output is kept for the error message.
 */
async function startDev(root, args) {
  const port = await freePort()
  const child = spawn(
    process.execPath,
    [DESCRIBE_ME_BIN, 'dev', '--data', '.describe-me', '--port', String(port), ...args],
    { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] },
  )

  const chunks = []

  child.stdout.on('data', (chunk) => chunks.push(chunk))
  child.stderr.on('data', (chunk) => chunks.push(chunk))

  return {
    child,
    url: `http://localhost:${port}/`,
    output: () => Buffer.concat(chunks).toString('utf8').replace(COLOURS, '').trim(),
  }
}

async function stopDev(dev) {
  const { child } = dev

  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  const exited = new Promise((resolve) => child.once('exit', resolve))
  const force = setTimeout(() => child.kill('SIGKILL'), 10_000)

  child.kill('SIGTERM')
  await exited
  clearTimeout(force)
}

/** What `__live.json` says once the preview stopped starting, or the last answer at the timeout. */
async function waitForPreview(dev) {
  const deadline = Date.now() + VIEWER_READY_TIMEOUT
  let last = null

  while (Date.now() < deadline && dev.child.exitCode === null) {
    try {
      const response = await fetch(new URL('__live.json', dev.url))

      last = response.ok ? await response.json() : last

      if (last !== null && last.status !== 'starting') {
        return last
      }
    } catch {
      // The viewer is not listening yet.
    }

    await delay(POLL * 5)
  }

  return last
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

/** A viewer page that keeps its console errors and page errors, and counts loads of the live frame. */
async function openViewer(browser, url, liveOrigin) {
  const browserContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })

  await browserContext.route(
    (target) => target.protocol === 'https:',
    (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }),
  )

  const page = await browserContext.newPage()
  const viewer = { browserContext, page, errors: [], loads: 0 }

  page.on('console', (message) => {
    if (message.type() === 'error') {
      viewer.errors.push(`console: ${message.text()}`)
    }
  })

  page.on('pageerror', (error) => viewer.errors.push(`page error: ${errorMessage(error)}`))
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame() && originOf(frame.url()) === liveOrigin) {
      viewer.loads += 1
    }
  })

  await page.goto(url)

  return viewer
}

function originOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
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
  const dev = await startDev(join(repoRoot, 'examples', name), [])
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
  const dev = await startDev(join(repoRoot, 'examples', name), ['--no-live'])

  try {
    const preview = await waitForPreview(dev)

    if (JSON.stringify(preview) !== JSON.stringify({ status: 'off' })) {
      return {
        problems: [
          `${label}: __live.json says ${JSON.stringify(preview)}, expected {"status":"off"}`,
        ],
        passed: 0,
      }
    }

    const viewer = await openViewer(browser, dev.url, null)

    try {
      await viewer.page
        .locator('.header .live .mono', { hasNotText: '…' })
        .waitFor({ state: 'visible', timeout: STATUS_TIMEOUT })

      const problems = [...viewer.errors]

      if (await viewer.page.locator('.live-toggle').isVisible()) {
        problems.push('the Live toggle shows')
      }

      return {
        problems: problems.map((problem) => `${label}: ${problem}`),
        passed: problems.length === 0 ? 1 : 0,
      }
    } finally {
      await viewer.browserContext.close()
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

// The check expects the flag unset before and after each server starts.
delete process.env[LIVE_ENV]

const host = await startHost()
const summaries = []
let problems = []
let behaviours = 0
let statuses = 0
let viewerSteps = 0
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
  `check-live: ok — ${summaries.join(', ')} mounted, ${behaviours} behaviours, ${statuses} statuses, viewer ${viewerSteps} steps`,
)
