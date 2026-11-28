/**
 * check-site's cases of the changes against a base: the marks, the header,
 * the timeline, the Changed filter and the first change on the shadcn pair
 * site, and the viewers of site/ built without `--base`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shownTests } from '../docs/shown-tests.mjs'

const VIEWER_TIMEOUT = 20_000
const LIVE_TIMEOUT = 30_000
const STEP_TIMEOUT = 5_000
const SETTLE_MS = 300
// `mounted` in packages/viewer/src/live-status-words.ts.
const MOUNTED_WORDS = 'mounted as the test arranged it'
// The report of shadcn against its SHADCN_CHANGED=1 run, as check-diff's scenario 19 has it.
const PAIR_COUNTS = { changed: 16, dom: 10, css: 6, added: 0, removed: 0, moved: 0 }

export const CARD = 'Card > renders a header, content and footer'
export const SUBMITS = 'SignupCard > submits the email'
export const REJECTS = 'SignupCard > rejects an empty email'
const INPUT = 'Input > shows its focus ring'

export const UNMARKED_INPUT = 'Input > renders a placeholder'
const REMOVED = 'OldCard > renders its title'
const GROUPS = ['Components', 'Components/ui']
const TAG = 'pair-check'
const NO_MATCH = 'zzz-no-match'
// The pill's text for each value of `data-change`, in packages/viewer/src/main-panel.ts.
const PILLS = { dom: 'dom', css: 'css', added: 'new' }

function errorMessage(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error)
}

/**
 * A page at 1280 px with the color scheme emulation off, whose remote
 * requests are answered locally. It keeps failed requests to the site and
 * page errors.
 */
export async function openPage(browser, url) {
  const context = await browser.newContext({
    colorScheme: null,
    viewport: { width: 1280, height: 800 },
  })

  await context.route(
    (target) => target.protocol === 'https:',
    (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }),
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

/** A new document, because a link that differs only in its hash would not reload the viewer. */
export async function freshLoad(page, target) {
  await page.goto('about:blank')
  await page.goto(target)
  await page.locator('.tree .test').first().waitFor({ timeout: VIEWER_TIMEOUT })
}

async function pageLink(page) {
  return new URLSearchParams(await page.evaluate(() => location.hash.slice(1)))
}

async function rowCount(page) {
  return page.locator('.tree .test').count()
}

/** Whether the sidebar settles on `count` rows. The viewer repaints after the event that changed it. */
async function showsRows(page, count) {
  return page
    .waitForFunction((rows) => document.querySelectorAll('.tree .test').length === rows, count, {
      timeout: STEP_TIMEOUT,
    })
    .then(() => true)
    .catch(() => false)
}

export function testOf(manifest, fullName) {
  for (const mod of manifest.modules) {
    const test = mod.tests.find((candidate) => candidate.fullName === fullName)

    if (test !== undefined) {
      return { ...test, moduleId: mod.id }
    }
  }

  throw new Error(`the manifest has no test "${fullName}"`)
}

export function entryOf(report, fullName) {
  const entry = report.tests.find((candidate) => candidate.fullName === fullName)

  if (entry === undefined) {
    throw new Error(`the report has no entry "${fullName}"`)
  }

  return entry
}

function rowOf(page, fullName) {
  return page.locator(`.tree .test[title="${fullName}"]`)
}

/** The header's counts, such as `{ changed: '2', added: '1' }`. */
async function headerCounts(page) {
  return page.$$eval('.header .changes-count', (counts) =>
    Object.fromEntries(
      counts.map((count) => [count.dataset.change, count.querySelector('b')?.textContent]),
    ),
  )
}

/** A problem when the link does not have these values, `null` for none. `null` means absent. */
export async function linkProblem(page, expected) {
  const link = await pageLink(page)
  const wrong = Object.entries(expected).filter(([key, value]) => link.get(key) !== value)

  return wrong.length === 0 ? null : `the link is #${link}, expected ${JSON.stringify(expected)}`
}

/** Waits until the test `id` shows its recorded frame `frame`, then that no live slot comes. */
async function recordedProblem(page, id, frame) {
  const shown = await page
    .locator(`.stage-slot[data-test="${id}"][data-frame="${frame}"]:not(.incoming) iframe`)
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })
    .then(() => true)
    .catch(() => false)

  if (!shown) {
    return `the stage does not show the recorded frame ${frame}`
  }

  await page.waitForTimeout(SETTLE_MS)

  return (await page.locator('.stage-slot.live-slot').count()) === 0 ? null : 'a live slot shows'
}

/**
 * The click on the breadcrumbs row takes the focus off any frame, so the key
 * reaches the viewer. It lands left of the first toggle, because the path can
 * have no width left while the Before / After switch shows.
 */
export async function pressInViewer(page, key) {
  await page.locator('.crumbs').click({ position: { x: 4, y: 4 } })
  await page.keyboard.press(key)
}

/** Each step returns a problem or `null`. The first problem ends the run. */
export async function firstProblem(steps) {
  for (const step of steps) {
    const problem = await step()

    if (problem !== null) {
      return problem
    }
  }

  return null
}

/** The marks of the sidebar and the header's counts on the real report. */
async function marksSteps(page, url, report) {
  const counts = report.counts.tests

  return firstProblem([
    async () => {
      const shown = Object.fromEntries(Object.keys(PAIR_COUNTS).map((key) => [key, counts[key]]))

      return JSON.stringify(shown) === JSON.stringify(PAIR_COUNTS)
        ? null
        : `the report counts ${JSON.stringify(shown)}, expected ${JSON.stringify(PAIR_COUNTS)}`
    },
    async () => {
      await freshLoad(page, url)

      const rows = {
        changed: await page.locator('.tree .test[data-change="changed"]').count(),
        dom: await page.locator('.tree .test[data-kind="dom"]').count(),
        css: await page.locator('.tree .test[data-kind="css"]').count(),
      }

      const expected = { changed: counts.changed, dom: counts.dom, css: counts.css }

      return JSON.stringify(rows) === JSON.stringify(expected)
        ? null
        : `the rows marked are ${JSON.stringify(rows)}, expected ${JSON.stringify(expected)}`
    },
    async () => {
      const missing = []

      for (const name of [CARD, SUBMITS, REJECTS]) {
        if (
          (await page.locator(`.tree .test[data-change="changed"][title="${name}"]`).count()) !== 1
        ) {
          missing.push(name)
        }
      }

      return missing.length === 0 ? null : `not marked changed: ${missing.join(', ')}`
    },
    async () => {
      const modules = await page.locator('.tree .module-button').count()
      const marked = await page.locator('.tree .module-button > .change-mark').count()
      const groups = []

      for (const group of GROUPS) {
        const mark = page.locator(`.tree [data-group="${group}"] > .group-row > .change-mark`)

        if ((await mark.count()) !== 1) {
          groups.push(group)
        }
      }

      if (modules === 0 || marked !== modules) {
        return `${marked} of ${modules} module rows carry a mark`
      }

      return groups.length === 0 ? null : `no mark on the group rows ${groups.join(', ')}`
    },
    async () => {
      const shown = await headerCounts(page)
      const expected = { changed: String(counts.changed) }

      return JSON.stringify(shown) === JSON.stringify(expected)
        ? null
        : `the header counts ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`
    },
  ])
}

/** `[index, data-change, pill]` of each frame the report marks, by head index. */
function expectedFrames(report, fullName) {
  return entryOf(report, fullName)
    .frames.filter((frame) => frame.head !== undefined)
    .filter((frame) => frame.change === 'added' || frame.kind !== undefined)
    .map((frame) => {
      const change = frame.change === 'added' ? 'added' : frame.kind

      return [frame.head.index, change, PILLS[change]]
    })
}

async function timelineProblem(page, url, report, manifest, fullName) {
  const id = testOf(manifest, fullName).id

  await freshLoad(page, `${url}#test=${id}&live=0`)
  await page.locator('.timeline .frame').first().waitFor({ timeout: VIEWER_TIMEOUT })

  const shown = await page.$$eval('.timeline .frame[data-frame]', (frames) =>
    frames
      .map((frame) => [
        Number(frame.dataset.frame),
        frame.dataset.change ?? null,
        frame.querySelector('.change-pill')?.textContent ?? null,
      ])
      .filter(([, change]) => change !== null),
  )

  const expected = expectedFrames(report, fullName)

  if (expected.length === 0) {
    return `the report marks no frame of ${fullName}`
  }

  return JSON.stringify(shown) === JSON.stringify(expected)
    ? null
    : `${fullName}: the timeline marks ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`
}

/**
 * The report and manifest that the filter's cases route: Card changed, the
 * first frame of SignupCard's submit left out, its other test added, an entry
 * for a test the manifest lacks and a removed test, and a tag on the added
 * test and on an unmarked one.
 */
export function routedPair(report, manifest) {
  const submits = entryOf(report, SUBMITS)
  const rejects = testOf(manifest, REJECTS)
  const side = { index: 0, label: 'render', snapshot: 'snapshots/not-there.json' }
  const tests = [
    entryOf(report, CARD),
    { ...submits, frames: submits.frames.filter((frame) => (frame.head?.index ?? -1) >= 1) },
    {
      change: 'added',
      id: rejects.id,
      module: rejects.moduleId,
      fullName: REJECTS,
      frames: rejects.frames.map((frame, index) => ({
        change: 'added',
        head: { index, label: String(frame.label ?? ''), snapshot: frame.snapshot },
      })),
    },
    {
      change: 'changed',
      id: 'no-such-test',
      module: 'src/components/gone.test.tsx',
      fullName: 'Gone > is not in this run',
      kind: 'dom',
      frames: [{ change: 'changed', kind: 'dom', base: side, head: side }],
    },
    {
      change: 'removed',
      id: 'removed-test',
      module: 'src/components/old-card.test.tsx',
      fullName: REMOVED,
      frames: [{ change: 'removed', base: side }],
    },
  ]

  const routedReport = {
    ...report,
    counts: {
      ...report.counts,
      tests: { ...report.counts.tests, changed: 2, dom: 2, css: 0, added: 1, removed: 1 },
    },
    tests,
  }

  const routedManifest = structuredClone(manifest)

  for (const mod of routedManifest.modules) {
    for (const test of mod.tests) {
      if (test.fullName === REJECTS || test.fullName === UNMARKED_INPUT) {
        test.tags = [...(test.tags ?? []), TAG]
      }
    }
  }

  return { routedReport, routedManifest }
}

/** The toggle, the search, the tag, the empty sidebar and the header on the routed pair. */
async function filterSteps(page, url) {
  return firstProblem([
    async () => {
      await freshLoad(page, url)

      const count = await page.locator('.changes-filter .changes-toggle .n').textContent()

      if (count !== '3') {
        return `the toggle shows ${count}, expected 3`
      }

      await page.locator('.changes-toggle').click()

      const pressed = await page.locator('.changes-toggle').getAttribute('aria-pressed')

      if (!(await showsRows(page, 3)) || pressed !== 'true') {
        return `the toggle shows ${await rowCount(page)} rows and aria-pressed="${pressed}", expected 3 and true`
      }

      return linkProblem(page, { changed: '1' })
    },
    async () => {
      await page.locator('.sidebar-search').fill('signup')

      return (await showsRows(page, 2))
        ? null
        : `the filter and the search signup show ${await rowCount(page)} rows, expected 2`
    },
    async () => {
      await freshLoad(page, `${url}#changed=1&tag=${TAG}`)

      return (await showsRows(page, 1))
        ? null
        : `#changed=1&tag=${TAG} shows ${await rowCount(page)} rows, expected 1`
    },
    async () => {
      const expected = `no changed tests tagged "${TAG}" match "${NO_MATCH}"`

      await page.locator('.sidebar-search').fill(NO_MATCH)

      const said = await page
        .locator('.tree > .empty', { hasText: expected })
        .waitFor({ timeout: STEP_TIMEOUT })
        .then(() => null)
        .catch(() => 'nothing')

      return said === null
        ? null
        : `a search that matches nothing shows ${await page.locator('.tree').innerText()}, expected ${expected}`
    },
    async () => {
      const shown = await headerCounts(page)
      const expected = { changed: '2', added: '1', removed: '1' }

      if (JSON.stringify(shown) !== JSON.stringify(expected)) {
        return `the header counts ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`
      }

      await page.locator('.header .changes > summary').click()

      const panel = page.locator('.header .changes .issues-panel')
      const listed = await panel.getByText(REMOVED, { exact: true }).count()
      const controls = await panel.locator('button, a').count()

      return listed === 1 && controls === 0
        ? null
        : `the panel lists ${REMOVED} ${listed} times, with ${controls} buttons and links`
    },
  ])
}

/** Opening at the first change under the filter, and in Live without it. */
async function firstChangeSteps(page, url, manifest) {
  const card = testOf(manifest, CARD).id
  const submits = testOf(manifest, SUBMITS).id
  const rejects = testOf(manifest, REJECTS).id
  const recorded = async (step, id, frame, link) => {
    const problem = (await recordedProblem(page, id, frame)) ?? (await linkProblem(page, link))

    return problem === null ? null : `${step}: ${problem}`
  }

  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#changed=1`)

      return recorded('#changed=1', card, 0, { test: card, live: '0', frame: null, changed: '1' })
    },
    async () => {
      await rowOf(page, SUBMITS).click()

      return recorded('a click under the filter', submits, 1, {
        test: submits,
        live: null,
        frame: '1',
        changed: '1',
      })
    },
    async () => {
      await pressInViewer(page, 'ArrowDown')

      return recorded('↓ under the filter', rejects, 0, {
        test: rejects,
        live: '0',
        frame: null,
        changed: '1',
      })
    },
    async () => {
      const frames = testOf(manifest, REJECTS).frames.length
      const pills = await page.$$eval('.timeline .frame[data-change="added"] .change-pill', (all) =>
        all.map((pill) => pill.textContent),
      )

      return JSON.stringify(pills) === JSON.stringify(Array(frames).fill(PILLS.added))
        ? null
        : `the added test's timeline shows the pills ${JSON.stringify(pills)} for ${frames} frames`
    },
    async () => {
      await freshLoad(page, url)
      await rowOf(page, SUBMITS).click()

      const mounted = await page
        .locator(`.stage-slot.live-slot[data-test="${submits}"]:not(.loading)`)
        .waitFor({ state: 'attached', timeout: LIVE_TIMEOUT })
        .then(() =>
          page
            .locator('.live-section .live-status', { hasText: MOUNTED_WORDS })
            .waitFor({ state: 'visible', timeout: LIVE_TIMEOUT }),
        )
        .then(() => null)
        .catch((error) => errorMessage(error))

      return mounted === null ? null : `a click without the filter does not open Live: ${mounted}`
    },
  ])
}

/** A report for another run and a body that is no JSON mark nothing. */
async function badReportSteps(page, url, served, routedReport) {
  const bodies = {
    'a report for another run': JSON.stringify({
      ...routedReport,
      head: { ...routedReport.head, generatedAt: '2000-01-01T00:00:00.000Z' },
    }),
    'a body that is no JSON': 'not json',
  }

  for (const [label, body] of Object.entries(bodies)) {
    served.changes = body
    await freshLoad(page, url)
    await page.waitForTimeout(SETTLE_MS)

    const marks = await page.locator('.change-mark, .header .changes').count()
    const toggle = await page.locator('.changes-filter').isVisible()

    if (marks > 0 || toggle) {
      return `${label}: ${marks} marks or chips and the toggle ${toggle ? 'shows' : 'hidden'}`
    }
  }

  return null
}

/** Runs `steps(page)` on a fresh page, and returns its problems with the label. */
export async function onPage(browser, url, label, steps) {
  const { context, page, failures } = await openPage(browser, url)

  try {
    const problem = await steps(page)

    return [problem, ...failures]
      .filter((entry) => entry !== null)
      .map((entry) => `${label}: ${entry}`)
  } catch (error) {
    return [`${label}: ${errorMessage(error)}`]
  } finally {
    await context.close()
  }
}

/**
 * The shadcn pair site served at `url`: the marks and the header on the real
 * report, the timeline of Card and of an Input test, then with a routed
 * report and manifest the filter, the first change and a bad report.
 */
export async function checkPairSite(browser, url, { report, manifest }) {
  const label = 'the shadcn pair site'
  const problems = await onPage(browser, url, `${label} marks`, (page) =>
    marksSteps(page, url, report),
  )

  if (problems.length === 0) {
    console.log(
      `check-site: the shadcn pair site marks ${report.counts.tests.changed} changed tests, ${report.counts.tests.dom} dom and ${report.counts.tests.css} css, Card and both SignupCard tests among them, every module row and both group rows, and its header says ${report.counts.tests.changed} changed`,
    )
  }

  const timeline = await onPage(browser, url, `${label} timeline`, async (page) => {
    return firstProblem(
      [CARD, INPUT].map((name) => () => timelineProblem(page, url, report, manifest, name)),
    )
  })

  if (timeline.length === 0) {
    console.log(
      `check-site: the shadcn pair site's timeline marks the frames of ${CARD} and ${INPUT} as the report does, dom and css apart`,
    )
  }

  const { routedReport, routedManifest } = routedPair(report, manifest)
  const served = { changes: JSON.stringify(routedReport) }
  const routed = await onPage(browser, url, `${label} filter`, async (page) => {
    await page.route('**/__data/changes.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: served.changes }),
    )

    await page.route('**/__data/manifest.json', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(routedManifest),
      }),
    )

    return firstProblem([
      () => filterSteps(page, url),
      () => firstChangeSteps(page, url, routedManifest),
      () => badReportSteps(page, url, served, routedReport),
    ])
  })

  if (routed.length === 0) {
    console.log(
      `check-site: the shadcn pair site's Changed filter shows 3 of a routed report, combines with the search and a tag, is changed=1 in the link and names itself when nothing matches, the header counts 2 changed, 1 added and 1 removed and lists the removed test as text, a test picked under the filter opens recorded at its first change, by a click, by ↓ and from #changed=1 alone, every frame of the added test says new, without the filter a click opens Live, and a report for another run or no JSON marks nothing`,
    )
  }

  return [...problems, ...timeline, ...routed]
}

/**
 * `before=1` and `removed=0` drop out of a link to a test, and neither the
 * Before / After switch nor a removed frame shows.
 */
async function noSidesProblem(page, target, id) {
  await freshLoad(page, `${target}#test=${id}&live=0&before=1&removed=0`)

  const dropped = await page
    .waitForFunction(
      () => {
        const link = new URLSearchParams(location.hash.slice(1))

        return !link.has('before') && !link.has('removed')
      },
      undefined,
      { timeout: STEP_TIMEOUT },
    )
    .then(() => true)
    .catch(() => false)

  await page.locator('.timeline .frame').first().waitFor({ timeout: VIEWER_TIMEOUT })
  await page.waitForTimeout(SETTLE_MS)

  const switches = await page.locator('.before-after').isVisible()
  const removed = await page.locator('.timeline .frame.removed').count()

  if (!dropped) {
    return `#test=${id}&live=0&before=1&removed=0 leaves the link #${await pageLink(page)}`
  }

  if (switches || removed > 0) {
    return `the Before / After switch ${switches ? 'shows' : 'is hidden'} and the timeline has ${removed} removed frames`
  }

  return linkProblem(page, { test: id, live: '0' })
}

/**
 * Every viewer of site/ built without `--base`: no request for a
 * `changes.json` or under `__base/`, no mark, no Changed filter and no chip,
 * and `#changed=1` drops out of the link with every test shown. A link with
 * `before=1` and `removed=0` loses both, and shows no Before / After switch
 * and no removed frame.
 */
export async function checkNoBaseViewers(browser, url, siteDir, names) {
  const problems = []

  for (const name of names) {
    const manifest = JSON.parse(
      readFileSync(join(siteDir, 'examples', name, '__data', 'manifest.json'), 'utf8'),
    )

    const shown = shownTests(manifest)
    const expected = shown.length
    const requested = []

    problems.push(
      ...(await onPage(browser, url, `examples/${name}/ without a base`, async (page) => {
        page.on('request', (request) => {
          const { pathname } = new URL(request.url())

          if (pathname.endsWith('changes.json') || pathname.includes('/__base/')) {
            requested.push(pathname)
          }
        })

        await freshLoad(page, `${url}examples/${name}/#changed=1`)

        const dropped = await page
          .waitForFunction(
            () => !new URLSearchParams(location.hash.slice(1)).has('changed'),
            undefined,
            {
              timeout: STEP_TIMEOUT,
            },
          )
          .then(() => true)
          .catch(() => false)

        await page.waitForTimeout(SETTLE_MS)

        const marks = await page.locator('.change-mark, .header .changes').count()
        const toggle = await page.locator('.changes-filter').isVisible()
        const rows = await rowCount(page)

        if (requested.length > 0) {
          return `it requests ${requested.join(', ')}`
        }

        if (marks > 0 || toggle) {
          return `${marks} marks or chips and the toggle ${toggle ? 'shows' : 'hidden'}`
        }

        if (!dropped || rows !== expected) {
          return `#changed=1 leaves the link #${await pageLink(page)} and ${rows} of ${expected} tests`
        }

        const sides = await noSidesProblem(page, `${url}examples/${name}/`, shown[0].id)

        if (sides !== null) {
          return sides
        }

        return requested.length === 0 ? null : `it requests ${requested.join(', ')}`
      })),
    )
  }

  if (problems.length === 0) {
    console.log(
      `check-site: ${names.length} viewers without a base request no changes.json and nothing under __base/, show no mark, filter or chip, drop #changed=1 from the link with every test shown, and drop before=1 and removed=0 from a link to a test, with no Before / After switch and no removed frame in the timeline`,
    )
  }

  return problems
}
