/**
 * What both parts of `check-live` need to show live pages: a host page on
 * another origin that frames them and keeps their messages, the URL of a
 * test's page, and the checks every mounted test must pass.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const LIVE_ENV = 'DESCRIBE_ME_LIVE'
export const LIVE_SOURCE = 'describe-me-live'
export const BASE = /^http:\/\/localhost:\d+\/__describe-me\/$/
export const FIRST_STATUS_TIMEOUT = 30_000
export const STATUS_TIMEOUT = 15_000
export const POLL = 50

const SIZE_TIMEOUT = 5_000

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

export function errorMessage(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error)
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The page that frames the live page, on 127.0.0.1, another origin than the live server's localhost. */
export function startHost() {
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

/** The manifest in `dir` of an example, which its tests wrote. */
export function readManifest(root, name, dir = '.describe-me') {
  const file = join(root, dir, 'manifest.json')

  if (!existsSync(file)) {
    throw new Error(`examples/${name} has no ${dir}/manifest.json. Run its tests first`)
  }

  return JSON.parse(readFileSync(file, 'utf8'))
}

/** `createLiveServer` as the example resolves it, so the check runs what a project installs. */
export async function importCreateLiveServer(root) {
  const entry = createRequire(join(root, 'package.json')).resolve('@describe-me/vitest/live')
  const { createLiveServer } = await import(pathToFileURL(entry).href)

  return createLiveServer
}

/** Every test of the manifest, in module and test order, with its occurrence in the module. */
export function manifestTests(manifest) {
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
export async function liveMessages(page) {
  const kept = await page.evaluate(() => window.liveMessages)

  return kept
    .filter((message) => message.data?.source === LIVE_SOURCE)
    .map((message) => ({ ...message.data, at: message.at }))
}

export async function waitForMessage(page, matches, timeout) {
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

/**
 * A browser context whose host page frames the live server at `base`. Remote
 * fonts and stylesheets of the preview head never decide the result, offline
 * or not. `close()` closes the context, not the server.
 */
export async function openHost(browser, host, name, base) {
  const browserContext = await browser.newContext()

  await browserContext.route(
    (url) => url.protocol === 'https:',
    (route) => {
      const type = route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/plain'

      return route.fulfill({ status: 200, contentType: type, body: '' })
    },
  )

  const page = await browserContext.newPage()
  const liveOrigin = new URL(base).origin

  await page.goto(host.url)
  await page.evaluate((origin) => {
    window.liveOrigin = origin
  }, liveOrigin)

  return {
    name,
    page,
    frame: page.frameLocator('#live'),
    base,
    hostOrigin: new URL(host.url).origin,
    watch: watchFrame(page, liveOrigin),
    close: () => browserContext.close(),
  }
}

/** Points the frame at a page, and waits for its status. */
export async function show(context, target, timeout) {
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

/** Waits for a size with a positive height after a `mounted` status. */
export async function checkSize(context, label, status) {
  const size = await waitForMessage(
    context.page,
    (message) => message.type === 'size' && message.height > 0,
    SIZE_TIMEOUT,
  )

  if (size === null || size.at - status.at > SIZE_TIMEOUT) {
    return [`${label}: no size with a positive height within ${SIZE_TIMEOUT / 1000} s`]
  }

  return []
}

/** Shows one test of the manifest, and checks that it mounts cleanly. */
export async function checkMount(context, test, timeout) {
  const label = `${context.name} ${test.file} ${test.fullName}`
  const status = await show(context, test, timeout)

  if (status === null) {
    return { problems: [`${label}: no status within ${timeout / 1000} s`] }
  }

  if (status.status !== 'mounted') {
    const detail = status.detail ? `: ${status.detail.split('\n')[0]}` : ''

    return { problems: [`${label}: ${status.status}${detail}`] }
  }

  return { problems: await checkSize(context, label, status), mountedAt: status.at }
}

/** What happened while the test was shown, beyond its status: loads and errors. */
export async function checkQuiet(context, label) {
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

export async function expectVisible(locator, what, timeout) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout })

    return []
  } catch {
    return [`${what} did not show within ${timeout / 1000} s`]
  }
}
