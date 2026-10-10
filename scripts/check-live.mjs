/**
 * Checks the live preview of both examples in headless Chromium. For each
 * example it starts `createLiveServer()` from `@describe-me/vitest/live` on
 * the config file its manifest names, frames the live page from a host page
 * on another origin, and shows every test of the manifest: each one must
 * report `mounted`, then a positive height, load the frame exactly once and
 * log no error. Six behaviours of live components follow: an action from a
 * `vi.fn()`, two rerenders from an empty fragment, a toast that hides itself
 * in real time, an async load, and a theme with global styles. Four pages
 * must report their status: `no-render`, two kinds of `not-found` and
 * `import-failed`. Remote requests are answered locally, so remote fonts
 * never decide the result. Run after `pnpm build` and both examples' tests.
 *
 * Usage: `node scripts/check-live.mjs`
 */
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
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

/** Pages that must report a status other than `mounted`, and show it in `body`. */
const STATUSES = {
  'react-browser': [
    { file: 'src/Menu.test.tsx', path: ['Menu', 'no such test'], status: 'not-found' },
    { file: '../src/Menu.test.tsx', path: USED, status: 'not-found' },
    { file: 'src/missing.test.tsx', path: USED, status: 'import-failed' },
  ],
  'react-jsdom': [
    {
      file: 'src/use-toggle.test.tsx',
      path: ['useToggle', 'flips its value'],
      status: 'no-render',
    },
  ],
}

async function checkStatus(context, expected) {
  const label = `${context.name} file=${expected.file}`
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

// The check expects the flag unset before and after each server starts.
delete process.env[LIVE_ENV]

const host = await startHost()
const summaries = []
let problems = []
let behaviours = 0
let statuses = 0
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
  `check-live: ok — ${summaries.join(', ')} mounted, ${behaviours} behaviours, ${statuses} statuses`,
)
