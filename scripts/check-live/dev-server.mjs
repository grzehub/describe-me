/**
 * `describe-me dev` for `check-live`: start it in an example on a data
 * directory, wait for what `__live.json` says, open its viewer and stop it.
 */
import { spawn } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'
import { join } from 'node:path'
import { repoRoot } from '../docs/repo-root.mjs'
import { delay, errorMessage, POLL, STATUS_TIMEOUT } from './live-frame.mjs'

const DESCRIBE_ME_BIN = join(repoRoot, 'packages', 'viewer', 'bin', 'describe-me.js')
const VIEWER_READY_TIMEOUT = 60_000
const COLOURS = new RegExp(String.raw`\u001b\[[\d;]*m`, 'g')

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
 * Starts `describe-me dev --data <data>` in an example, without a shell, with
 * `env` on top of this process's environment. Vite closes its dev server when
 * stdin ends, unless `CI` is exactly `true`, so stdin stays piped and open.
 * The output is kept for the error message.
 */
export async function startDev(root, data, args = [], env = {}) {
  const port = await freePort()
  const child = spawn(
    process.execPath,
    [DESCRIBE_ME_BIN, 'dev', '--data', data, '--port', String(port), ...args],
    { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } },
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

export async function stopDev(dev) {
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
export async function waitForPreview(dev) {
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

function originOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** A viewer page that keeps its console errors and page errors, and counts loads of the live frame. */
export async function openViewer(browser, url, liveOrigin) {
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

/**
 * The viewer of a `describe-me dev` whose preview is off: `__live.json` says
 * exactly `{"status":"off"}`, and the page shows no Live toggle and logs no
 * error. Returns the problems.
 */
export async function checkLiveOffViewer(browser, dev) {
  const preview = await waitForPreview(dev)

  if (JSON.stringify(preview) !== JSON.stringify({ status: 'off' })) {
    return [`__live.json says ${JSON.stringify(preview)}, expected {"status":"off"}`]
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

    return problems
  } finally {
    await viewer.browserContext.close()
  }
}
