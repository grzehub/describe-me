/**
 * What each test of both examples' `live-fixtures/` must do in the live
 * preview, by example and full test name: its status, the case it covers
 * and, for some, a behaviour to check once it shows.
 */
import { delay, expectVisible, liveMessages } from './live-frame.mjs'

const TEARDOWN_WAIT = 1_000

function listed(value) {
  return JSON.stringify(value)
}

/**
 * The steps the arrange phase took equal the steps Vitest takes, which the
 * test asserts in the real run. A second later the array on `globalThis` is
 * the same, so no teardown ran.
 */
async function ordersLikeVitest({ frame }) {
  const body = frame.locator('body')
  const shown = await body.evaluate(() => {
    const items = (label) =>
      [...document.querySelectorAll(`[aria-label="${label}"] li`)].map((item) => item.textContent)

    return { steps: items('steps'), expected: items('expected steps') }
  })

  if (shown.expected.length === 0) {
    return ['the page shows no expected steps']
  }

  if (listed(shown.steps) !== listed(shown.expected)) {
    return [`the steps ${listed(shown.steps)} differ from Vitest's ${listed(shown.expected)}`]
  }

  await delay(TEARDOWN_WAIT)

  const later = await body.evaluate(() => globalThis.liveFixtureLog)

  if (listed(later) !== listed(shown.expected)) {
    return [`a second later the steps are ${listed(later)}, so a teardown ran`]
  }

  return []
}

function shows(text) {
  return ({ frame }) => expectVisible(frame.getByText(text), listed(text), 5_000)
}

/** Each occurrence of a repeated name mounts its own row. */
async function showsItsOwnRow({ frame, test }) {
  const [own, other] =
    test.occurrence === 1
      ? ['the first row', 'the second row']
      : ['the second row', 'the first row']

  const problems = await expectVisible(frame.getByText(own), listed(own), 5_000)

  if ((await frame.getByText(other).count()) > 0) {
    problems.push(`occurrence ${test.occurrence} shows ${listed(other)}`)
  }

  return problems
}

/** Exactly one notice for each of `calls`, such as `vi.mock("./clock")`. */
async function noticesFor(page, calls) {
  const notices = (await liveMessages(page))
    .filter((message) => message.type === 'notice')
    .map((message) => message.message)

  return calls.flatMap((call) => {
    const count = notices.filter((notice) => notice.startsWith(`${call} `)).length

    return count === 1 ? [] : [`${count} notices for ${call}, expected 1: ${listed(notices)}`]
  })
}

/** The real modules' values show, and each mocked module posted one notice. */
async function keepsTheRealModules({ frame, page }) {
  const text = 'the real clock, the real forecast'

  return [
    ...(await expectVisible(frame.getByText(text), listed(text), 5_000)),
    ...(await noticesFor(page, ['vi.mock("./clock")', 'vi.doMock("./weather")'])),
  ]
}

/** server.browser.ts from `live.setupFiles` answers the fetch, and setup.ts's `vi.mock` posts a notice. */
async function servesTheBrowserData({ frame, page }) {
  const text = 'Hello from the stub server'

  return [
    ...(await expectVisible(frame.getByText(text), listed(text), 5_000)),
    ...(await noticesFor(page, ['vi.mock("./analytics")'])),
  ]
}

const NAMES = 'each and for names with %s %d %i %f %j %o %# %$ %%, $key and $0'

/** The names of names.test.tsx, the same in both examples, with the rules of Vitest 5. */
const NAME_EXPECTATIONS = {
  [`Names > each Ada 36 7 -0.5 {"tier":"gold"} [ 'a', 'b' ], row 0 of 1, 100% done`]: {
    status: 'mounted',
    covers: NAMES,
  },
  'Names > each Grace 45 2 1.25 {"tier":"silver"} [], row 1 of 2, 100% open': {
    status: 'mounted',
    covers: NAMES,
  },
  'Names > each Ada as admin': { status: 'mounted', covers: NAMES },
  'Names > each Grace as editor': { status: 'mounted', covers: NAMES },
  'Names > each first is number 1': { status: 'mounted', covers: NAMES },
  'Names > each second is number 2': { status: 'mounted', covers: NAMES },
  'Names > table Ada has 1': { status: 'mounted', covers: 'a tagged-template table' },
  'Names > table Grace has 2': { status: 'mounted', covers: 'a tagged-template table' },
  'Names > for Ada with 1': {
    status: 'mounted',
    covers: 'a for body that uses a fixture',
    check: shows('from a fixture'),
  },
  'Names > for Grace with 2': {
    status: 'mounted',
    covers: 'a for body that uses a fixture',
    check: shows('from a fixture'),
  },
  'Names > repeated twin': {
    status: 'mounted',
    covers: 'a repeated name',
    check: showsItsOwnRow,
  },
  'Names in light > show the theme': { status: 'mounted', covers: 'describe.each' },
  'Names in dark > show the theme': { status: 'mounted', covers: 'describe.each' },
}

const FIXTURES = {
  'Fixtures > computes the fixtures the test uses': {
    status: 'mounted',
    covers:
      'test.extend with a dependency, an auto fixture, an unused fixture, the builder syntax, test.beforeEach with a fixture and a teardown that never runs',
    check: ordersLikeVitest,
  },
}

export const FIXTURE_EXPECTATIONS = {
  'react-browser': {
    'Setup files > run their hooks before the hooks of the test file': {
      status: 'mounted',
      covers: "setup-file hooks in Vitest's order",
      check: ordersLikeVitest,
    },
    ...FIXTURES,
    'Around hooks > wrap the rest of the arrange phase': {
      status: 'mounted',
      covers: 'aroundEach and aroundAll',
      check: ordersLikeVitest,
    },
    ...NAME_EXPECTATIONS,
    'Module mocks > keep the real modules live': {
      status: 'mounted',
      covers: 'vi.mock and vi.doMock in a test file',
      check: keepsTheRealModules,
    },
  },
  'react-jsdom': {
    'Setup files > serve the data the component fetches': {
      status: 'mounted',
      covers:
        'live.setupFiles replacing a Node-only setup file, a package entry in the setup files and vi.mock in a setup file',
      check: servesTheBrowserData,
    },
    ...FIXTURES,
    ...NAME_EXPECTATIONS,
    'Node-only import > reads a file in the arrange phase': {
      status: 'import-failed',
      detail: 'node:fs',
      covers: 'a Node-only import',
    },
  },
}
