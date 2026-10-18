/**
 * The viewer's messages to the live page, posted by the host page on another
 * origin to react-browser's `Menu > selects an item and reports it`. A
 * `dark-variant` request puts its class and attribute on `<html>`, `null`
 * takes back only what the page applied, and the page ignores another source,
 * an unknown type, an `on*` attribute, its own status attribute and a class
 * with a space. A request that comes before the status waits for it, so a
 * class the arrange phase sets stays the test's. Each page loads once and logs
 * no error. Last, a page whose URL names another origin ignores a valid
 * request.
 */
import { checkQuiet, delay, pageUrl, show, STATUS_TIMEOUT } from './live-frame.mjs'

const VIEWER_SOURCE = 'describe-me-viewer'
const TEST = { file: 'src/Menu.test.tsx', path: ['Menu', 'selects an item and reports it'] }
const BOTH = { className: 'dark', attribute: { name: 'data-theme', value: 'dark' } }
const ROOT_TIMEOUT = 5_000
const ROOT_POLL = 50
// Long enough for a message to reach a page that would apply it.
const IGNORED_MS = 500

function request(root) {
  return { source: VIEWER_SOURCE, type: 'dark-variant', root }
}

/** Posts from the host page, as the viewer posts to the live frame. */
async function post(context, message) {
  await context.page.evaluate((data) => {
    document.getElementById('live').contentWindow.postMessage(data, window.liveOrigin)
  }, message)
}

/** The live page's `<html>`: its classes and its attributes. */
function readRoot(context) {
  return context.frame.locator('html').evaluate((root) => ({
    classes: [...root.classList],
    attributes: Object.fromEntries(
      root.getAttributeNames().map((name) => [name, root.getAttribute(name)]),
    ),
  }))
}

function editRoot(context, edit) {
  return context.frame.locator('html').evaluate((root, { add, remove, attributes }) => {
    root.classList.add(...(add ?? []))
    root.classList.remove(...(remove ?? []))

    for (const [name, value] of Object.entries(attributes ?? {})) {
      if (value === null) {
        root.removeAttribute(name)
      } else {
        root.setAttribute(name, value)
      }
    }
  }, edit)
}

/** Polls the root until `matches` holds. Returns a problem or `null`. */
async function waitForRoot(context, matches, expected) {
  const deadline = Date.now() + ROOT_TIMEOUT
  let seen = null

  while (Date.now() < deadline) {
    seen = await readRoot(context)

    if (matches(seen)) {
      return null
    }

    await delay(ROOT_POLL)
  }

  return `the root shows ${JSON.stringify(seen)}, expected ${expected}`
}

function hasBoth(root) {
  return root.classes.includes('dark') && root.attributes['data-theme'] === 'dark'
}

function hasNeither(root) {
  return !root.classes.includes('dark') && !('data-theme' in root.attributes)
}

async function mounts(context) {
  const status = await show(context, TEST, STATUS_TIMEOUT)

  return status?.status === 'mounted'
    ? null
    : `the page reported ${status?.status ?? 'no status'}, expected mounted`
}

async function putsBoth(context) {
  await post(context, request(BOTH))

  return waitForRoot(context, hasBoth, 'class dark and data-theme="dark"')
}

async function nullRemovesBoth(context) {
  await post(context, request(null))

  return waitForRoot(context, hasNeither, 'neither class dark nor data-theme')
}

/** What the test set itself stays: its class, and its attribute's value once the request is taken back. */
async function keepsTheTests(context) {
  await editRoot(context, { add: ['dark'], attributes: { 'data-theme': 'light' } })
  await post(context, request(BOTH))

  const applied = await waitForRoot(context, hasBoth, 'class dark and data-theme="dark"')

  if (applied) {
    return applied
  }

  await post(context, request(null))

  const restored = await waitForRoot(
    context,
    (root) => root.classes.includes('dark') && root.attributes['data-theme'] === 'light',
    'class dark kept and data-theme="light" restored',
  )

  // Back to the root as the test left it, for the cases after.
  await editRoot(context, { remove: ['dark'], attributes: { 'data-theme': null } })

  return restored
}

/**
 * Messages the page must ignore. Each is followed by a valid request, and
 * messages from one window arrive in order, so once the valid one shows the
 * ignored one has been read.
 */
const IGNORED = [
  ['another source', { ...request({ className: 'from-elsewhere' }), source: 'describe-me-live' }],
  ['an unknown type', { ...request({ className: 'unknown-type' }), type: 'theme' }],
  [
    'an attribute named onclick',
    request({ className: 'with-onclick', attribute: { name: 'onclick', value: 'run' } }),
  ],
  [
    'an attribute named data-describe-me-live',
    request({
      className: 'with-status',
      attribute: { name: 'data-describe-me-live', value: 'failed' },
    }),
  ],
  ['a class with a space', request({ className: 'dark extra' })],
]

/** The root without `data-check`, which the valid request after each ignored one sets. */
async function rootWithoutCheck(context) {
  const root = await readRoot(context)

  delete root.attributes['data-check']

  return JSON.stringify(root)
}

function ignores(message, index) {
  return async (context) => {
    const marker = String(index)
    const before = await rootWithoutCheck(context)

    await post(context, message)
    await post(context, request({ attribute: { name: 'data-check', value: marker } }))

    const shown = await waitForRoot(
      context,
      (root) => root.attributes['data-check'] === marker,
      `data-check="${marker}" from the valid request after it`,
    )

    if (shown) {
      return shown
    }

    const after = await rootWithoutCheck(context)

    return after === before ? null : `the page took it: the root went from ${before} to ${after}`
  }
}

/** Requests before the status wait for it, so the page never owns a class the arrange phase sets. */
async function waitsForTheStatus(context) {
  const { page } = context
  let release = () => {}
  let requested = () => {}
  const gate = new Promise((resolve) => {
    release = resolve
  })

  const seen = new Promise((resolve) => {
    requested = resolve
  })

  const isTestFile = (url) => url.pathname === `/${TEST.file}`

  await page.route(isTestFile, async (route) => {
    requested()
    await gate
    await route.continue()
  })

  try {
    const status = show(context, TEST, STATUS_TIMEOUT)

    await seen
    await post(context, request(BOTH))
    await delay(IGNORED_MS)

    const early = await readRoot(context)

    if (!hasNeither(early)) {
      release()
      await status

      return `before the status the root shows ${JSON.stringify(early)}, expected neither`
    }

    await editRoot(context, { add: ['dark'] })
    release()

    const mounted = await status

    if (mounted?.status !== 'mounted') {
      return `the page reported ${mounted?.status ?? 'no status'}, expected mounted`
    }

    const applied = await waitForRoot(context, hasBoth, 'class dark and data-theme="dark"')

    if (applied) {
      return `after the status: ${applied}`
    }

    await post(context, request(null))

    return waitForRoot(
      context,
      (root) => root.classes.includes('dark') && !('data-theme' in root.attributes),
      'class dark kept, data-theme removed',
    )
  } finally {
    release()
    await page.unroute(isTestFile)
  }
}

/** Its own posts go to the wrong origin, so it never reports to the host, and Chromium may log that. */
async function ignoresAnotherViewer(context) {
  const src = pageUrl(context.base, 'http://other.test', TEST)

  await context.page.evaluate((url) => {
    document.getElementById('live').src = url
  }, src)

  await context.frame
    .locator('html[data-describe-me-live]')
    .waitFor({ state: 'attached', timeout: STATUS_TIMEOUT })

  await post(context, request(BOTH))
  await delay(IGNORED_MS)

  const root = await readRoot(context)

  return hasNeither(root) ? null : `the page took it: the root shows ${JSON.stringify(root)}`
}

/** Runs the cases of one page in order, and stops at the first that fails. */
async function runCases(context, cases, result) {
  for (const [name, run] of cases) {
    let problem

    try {
      problem = await run(context)
    } catch (error) {
      problem = error instanceof Error ? error.message.split('\n')[0] : String(error)
    }

    if (problem) {
      result.problems.push(`${context.name} viewer messages, ${name}: ${problem}`)

      return false
    }

    result.passed += 1
  }

  return true
}

/**
 * The viewer's messages to the live page, in the host `context` of
 * react-browser. Returns the problems and the number of cases that passed.
 */
export async function checkViewerMessages(context) {
  const result = { problems: [], passed: 0 }
  const label = `${context.name} viewer messages`

  const ignored = IGNORED.map(([name, message], index) => [
    `ignores ${name}`,
    ignores(message, index),
  ])

  const mounted = await runCases(
    context,
    [
      ['mounts', mounts],
      ['a request puts both', putsBoth],
      ['null removes both', nullRemovesBoth],
      ["the test's own class and attribute stay", keepsTheTests],
      ...ignored,
    ],
    result,
  )

  const quiet = [...(await checkQuiet(context, label))]

  if (mounted && (await runCases(context, [['before the status', waitsForTheStatus]], result))) {
    quiet.push(...(await checkQuiet(context, `${label}, before the status`)))
  }

  result.problems.push(...quiet)
  result.passed += quiet.length === 0 ? 1 : 0

  await runCases(context, [['a page for another origin', ignoresAnotherViewer]], result)

  return result
}
