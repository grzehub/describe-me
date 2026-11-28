import type { ChangesReport, FrameChange, Look, ShotsSummary, TestShot } from './changes-report.js'
import { compareShots } from './compare-shots.js'
import { composeShot } from './compose-shot.js'
import type { ShotBrowser, ShotContext, ShotPage } from './import-playwright.js'
import { importPlaywright } from './import-playwright.js'
import { launchChromium } from './launch-chromium.js'
import { mapWithConcurrency } from './map-with-concurrency.js'
import { reasonOf } from './reason-of.js'
import type { DiffRun } from './read-run.js'
import type { ShotSide } from './render-shot.js'
import { renderShot } from './render-shot.js'
import { reportWithShots } from './report-with-shots.js'
import { shotFileName } from './shot-file-name.js'
import type { AddedShot, ShotPair, ShotPlan } from './shot-plan.js'
import { shotPlan } from './shot-plan.js'
import { startFrameServer } from './start-frame-server.js'
import { testLook } from './test-look.js'
import { waitForFrame } from './wait-for-frame.js'

const PIXEL_RATIO = 2
const VIEWPORT_HEIGHT = 720
const PAGES_AT_ONCE = 4
const WARM_UP_ATTEMPTS = 3

/** What `diff --shots` renders and where Playwright comes from. */
export interface ShotsOptions {
  base: DiffRun
  head: DiffRun
  /** The frame width in CSS pixels. */
  width: number
  /** The most images to write. */
  maxShots: number
  /** The project to load Playwright from. */
  root: string
}

/** An image for `--out`. */
export interface ShotImage {
  file: string
  png: Buffer
}

/** The report with looks and shots, and the images it names. */
export interface TakenShots {
  report: ChangesReport
  images: ShotImage[]
}

/** Renders each distinct side once, and shares a render that is still running. */
type Render = (shot: ShotSide) => Promise<Buffer | undefined>

function renderOnce(context: ShotContext, origin: string, width: number): Render {
  const renders = new Map<string, Promise<Buffer | undefined>>()

  return (shot) => {
    const key = `${shot.side}\0${shot.snapshot}`
    let pending = renders.get(key)

    if (pending === undefined) {
      pending = renderShot(context, origin, shot, width)
      renders.set(key, pending)
    }

    return pending
  }
}

/**
 * The first load may make Vite optimize the viewer's dependencies and reload
 * the page, so `frame.html` loads once alone, until it reports, before frames
 * render side by side. Without a snapshot it reports an error at once.
 */
async function warmUp(context: ShotContext, origin: string): Promise<void> {
  for (let attempt = 0; attempt < WARM_UP_ATTEMPTS; attempt++) {
    const page = await context.newPage()

    try {
      await waitForFrame(page, `${origin}/frame.html`)

      return
    } catch {
      // Tried again. The frames report what still fails.
    } finally {
      await page.close().catch(() => undefined)
    }
  }
}

function warn(text: string): void {
  process.stderr.write(`describe-me: ${text}\n`)
}

async function comparePair(page: ShotPage, pair: ShotPair, render: Render): Promise<void> {
  const [before, after] = await Promise.all([render(pair.base), render(pair.head)])

  if (before === undefined || after === undefined) {
    return
  }

  try {
    pair.look = await compareShots(page, before, after)
  } catch (error) {
    warn(`cannot compare ${pair.base.snapshot} with ${pair.head.snapshot} (${reasonOf(error)})`)
  }
}

/** The image of a test that looks different: its first pair, in frame order, that does. */
async function differentImage(
  page: ShotPage,
  frame: FrameChange,
  pair: ShotPair,
  render: Render,
): Promise<{ png: Buffer; frame: number } | undefined> {
  const [before, after] = await Promise.all([render(pair.base), render(pair.head)])

  if (before === undefined || after === undefined || frame.head === undefined) {
    return undefined
  }

  try {
    return { png: await composeShot(page, before, after), frame: frame.head.index }
  } catch (error) {
    warn(`cannot draw the image of ${pair.head.snapshot} (${reasonOf(error)})`)
    return undefined
  }
}

interface Budget {
  different: { id: string; frame: FrameChange; pair: ShotPair }[]
  added: AddedShot[]
}

/** Tests that look different take the images first, in report order, then added tests. */
function budgetOf(report: ChangesReport, plan: ShotPlan, maxShots: number): Budget {
  const lookOf = (frame: FrameChange): Look | undefined => plan.pairOf.get(frame)?.look
  const different: Budget['different'] = []

  for (const test of report.tests) {
    const frame = test.frames.find((entry) => lookOf(entry) === 'different')
    const pair = frame === undefined ? undefined : plan.pairOf.get(frame)

    if (testLook(test, lookOf) === 'different' && frame !== undefined && pair !== undefined) {
      different.push({ id: test.id, frame, pair })
    }
  }

  const chosen = different.slice(0, maxShots)

  return { different: chosen, added: plan.added.slice(0, maxShots - chosen.length) }
}

async function drawImages(
  page: ShotPage,
  budget: Budget,
  render: Render,
): Promise<Map<string, { png: Buffer; frame: number }>> {
  const drawn = new Map<string, { png: Buffer; frame: number }>()

  for (const { id, frame, pair } of budget.different) {
    const image = await differentImage(page, frame, pair, render)

    if (image !== undefined) {
      drawn.set(id, image)
    }
  }

  const added = await mapWithConcurrency(budget.added, PAGES_AT_ONCE, (shot) => render(shot.head))

  budget.added.forEach((shot, i) => {
    const png = added[i]

    if (png !== undefined) {
      drawn.set(shot.test.id, { png, frame: shot.frame })
    }
  })

  return drawn
}

function summaryOf(plan: ShotPlan, options: ShotsOptions, images: number): ShotsSummary {
  return {
    width: options.width,
    pixelRatio: PIXEL_RATIO,
    maxShots: options.maxShots,
    pairs: plan.pairs.length,
    differentPairs: plan.pairs.filter((pair) => pair.look === 'different').length,
    failedPairs: plan.pairs.filter((pair) => pair.look === undefined).length,
    images,
  }
}

function taken(
  report: ChangesReport,
  plan: ShotPlan,
  options: ShotsOptions,
  drawn: Map<string, { png: Buffer; frame: number }>,
): TakenShots {
  const shots = new Map<string, TestShot>()
  const images: ShotImage[] = []

  for (const [id, image] of drawn) {
    const file = shotFileName(id)
    shots.set(id, { file, frame: image.frame })
    images.push({ file, png: image.png })
  }

  return {
    report: reportWithShots(report, {
      lookOf: (frame) => plan.pairOf.get(frame)?.look,
      shots,
      summary: summaryOf(plan, options, images.length),
    }),
    images,
  }
}

async function shootIn(
  context: ShotContext,
  origin: string,
  report: ChangesReport,
  plan: ShotPlan,
  options: ShotsOptions,
): Promise<TakenShots> {
  const render = renderOnce(context, origin, options.width)
  const sides = plan.pairs.flatMap((pair) => [pair.base, pair.head])

  await warmUp(context, origin)
  await mapWithConcurrency(sides, PAGES_AT_ONCE, render)

  const page = await context.newPage()

  try {
    for (const pair of plan.pairs) {
      await comparePair(page, pair, render)
    }

    return taken(
      report,
      plan,
      options,
      await drawImages(page, budgetOf(report, plan, options.maxShots), render),
    )
  } finally {
    await page.close().catch(() => undefined)
  }
}

async function shootWith(
  browser: ShotBrowser,
  report: ChangesReport,
  plan: ShotPlan,
  options: ShotsOptions,
): Promise<TakenShots> {
  const server = await startFrameServer(options.head.dir, options.base.dir)

  try {
    const context = await browser.newContext({
      viewport: { width: options.width, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: PIXEL_RATIO,
      colorScheme: 'light',
    })

    try {
      return await shootIn(context, server.origin, report, plan, options)
    } finally {
      await context.close().catch(() => undefined)
    }
  } finally {
    await server.close()
  }
}

/**
 * Render the changed frames of a report before and after in Chromium,
 * compare their pixels and draw an image for each test that looks different,
 * then for added tests, at most `maxShots` in all. Playwright, Chromium and
 * the viewer's server start only when there is something to render. Throws
 * when Playwright or Chromium is missing. A frame that does not render only
 * warns.
 */
export async function takeShots(report: ChangesReport, options: ShotsOptions): Promise<TakenShots> {
  const plan = shotPlan(report, options.head.manifest)

  if (plan.pairs.length === 0 && (options.maxShots === 0 || plan.added.length === 0)) {
    return taken(report, plan, options, new Map())
  }

  const browser = await launchChromium(await importPlaywright(options.root))

  try {
    return await shootWith(browser, report, plan, options)
  } finally {
    await browser.close().catch(() => undefined)
  }
}
