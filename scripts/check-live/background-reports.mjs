/**
 * The live page's background reports, from a host page without Playwright's
 * light emulation, so the iframe's own scheme reaches the page. In shadcn's
 * `SignupCard > submits the email` a `dark-variant` request for `.dark`, which
 * the host posts as the viewer does, brings a report with another `body`. In
 * mui's `PlanCard > marks the popular plan` a dark `color-scheme` on the
 * iframe makes Material UI switch to its dark scheme at runtime, and the page
 * reports its dark `background.default`. Each page loads once and logs no
 * error.
 */
import {
  checkQuiet,
  delay,
  liveMessages,
  openHost,
  POLL,
  show,
  STATUS_TIMEOUT,
} from './live-frame.mjs'

const VIEWER_SOURCE = 'describe-me-viewer'
const REPORT_TIMEOUT = 5_000
// Material UI's dark `background.default`, #121212.
const MUI_DARK_BODY = 'rgb(18, 18, 18)'

async function postsTheDarkClass({ page }) {
  await page.evaluate(
    (data) => {
      document.getElementById('live').contentWindow.postMessage(data, window.liveOrigin)
    },
    { source: VIEWER_SOURCE, type: 'dark-variant', root: { className: 'dark' } },
  )
}

async function setsADarkScheme({ page }) {
  await page.evaluate(() => {
    document.getElementById('live').style.colorScheme = 'dark'
  })
}

/** What each example's page gets, and the report that must follow. */
const CASES = {
  shadcn: {
    test: {
      file: 'src/components/signup-card.test.tsx',
      path: ['SignupCard', 'submits the email'],
    },
    change: 'the dark variant',
    act: postsTheDarkClass,
    matches: (first, report) => report.body !== first.body,
    expected: (first) => `a body other than ${first.body}`,
  },
  mui: {
    test: {
      file: 'src/components/PlanCard.test.tsx',
      path: ['PlanCard', 'marks the popular plan'],
    },
    change: 'a scheme change',
    act: setsADarkScheme,
    matches: (_first, report) => report.body === MUI_DARK_BODY,
    expected: () => `body ${MUI_DARK_BODY}`,
  },
}

function backgroundReports(messages) {
  return messages.filter((message) => message.type === 'background')
}

/** Polls for a background report after the first `count` that `matches` the first one. */
async function waitForReport(context, count, matches) {
  const deadline = Date.now() + REPORT_TIMEOUT

  while (Date.now() < deadline) {
    const reports = backgroundReports(await liveMessages(context.page))
    const found = reports.slice(count).find(matches)

    if (found) {
      return found
    }

    await delay(POLL)
  }

  return null
}

async function reportsAfterChange(context, entry) {
  const status = await show(context, entry.test, STATUS_TIMEOUT)

  if (status?.status !== 'mounted') {
    return { problem: `the page reported ${status?.status ?? 'no status'}, expected mounted` }
  }

  const reports = backgroundReports(await liveMessages(context.page))
  const [first] = reports

  if (!first) {
    return { problem: 'no background report came with the status' }
  }

  await entry.act(context)

  const report = await waitForReport(context, reports.length, (candidate) =>
    entry.matches(first, candidate),
  )

  if (!report) {
    const last = backgroundReports(await liveMessages(context.page)).at(-1)

    return {
      problem: `after ${entry.change} the last report is ${JSON.stringify(last)}, expected ${entry.expected(first)}`,
    }
  }

  return { first, report }
}

/**
 * The background report after a change of the live page, for the examples
 * in CASES, on the live server at `base`. Returns the problems and the log
 * line of a case that passed.
 */
export async function checkBackgroundReports(browser, host, name, base) {
  const entry = CASES[name]

  if (!entry) {
    return { problems: [], line: null }
  }

  const label = `${name} ${entry.test.path.join(' > ')}`
  const context = await openHost(browser, host, name, base, null)

  try {
    const { problem, first, report } = await reportsAfterChange(context, entry)
    const problems = [
      ...(problem ? [`${label}, background after ${entry.change}: ${problem}`] : []),
      ...(await checkQuiet(context, `${label}, background after ${entry.change}`)),
    ]

    if (problems.length > 0) {
      return { problems, line: null }
    }

    return {
      problems: [],
      line: `check-live: ${label} reports its background after ${entry.change}, body ${first.body} then ${report.body}`,
    }
  } finally {
    await context.close()
  }
}
