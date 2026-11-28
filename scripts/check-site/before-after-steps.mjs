/**
 * check-site's cases of Before and After on the shadcn pair site, which
 * `describe-me build --base --live` builds. On the real report: the switch on
 * Card, a click, `B` and `before=1`, the inspector, the same zoom and width on
 * both sides, the toolbar's row at 1280, 1366 and 390 px, another frame,
 * another test, Live, the preview head of each run, a base that does not load
 * and a base manifest that loads on a later poll. With a routed report and
 * base manifest: an added frame, a removed frame in the timeline, links that
 * name a side the report does not have, and `#changed=1` on a test whose
 * first change is a removed frame.
 */
import {
  CARD,
  REJECTS,
  SUBMITS,
  UNMARKED_INPUT,
  entryOf,
  firstProblem,
  freshLoad,
  linkProblem,
  onPage,
  pressInViewer,
  routedPair,
  testOf,
} from './changes-steps.mjs'

const VIEWER_TIMEOUT = 20_000
const LIVE_TIMEOUT = 30_000
const SETTLE_MS = 300
// Button's default size in the base run (`h-9`) and with SHADCN_CHANGED=1 (`h-10`).
const BEFORE_HEIGHT = '36px'
const AFTER_HEIGHT = '40px'
// The rule that SHADCN_CHANGED=1 adds to src/index.css, so every frame's global stylesheet has it.
const NEW_RULE = '.badge-spaced'
const UPGRADE = 'Upgrade'
const WIDE = 1600
// Window widths with both panels open, where the row must hold the path, the zoom and the inspector toggle.
const ROW_WIDTHS = [1280, 1366]
const NARROW = 390
const MARKER = 'describe-me-check'
// The frame the routed report says this run lost, between frames 0 and 1 of SignupCard's submit test.
const REMOVED_FRAME = { index: 1, kind: 'step', label: 'a step this run no longer takes', at: 4242 }
// The routed report's name for the base side of SignupCard's frame 1, which the head names otherwise.
const BASE_LABEL = 'type the email, as the base run named it'
// A prop that only frame 0 of SignupCard's submit test has in the routed manifest.
const FRAME_PROP = 'routedFrameProp'
// The routed report's removed frame at the start of Card, the first test under the Changed filter.
const FIRST_REMOVED_LABEL = 'a render this run no longer has'
// The inspector's key hint while a frame has both sides, in packages/viewer/src/inspector.ts.
const SIDE_KEY = 'B before / after'
// What the stage says when the base side does not load, in packages/viewer/src/stage.ts.
const BASE_MISSING = 'the base frame did not load'
// The static site's poll in packages/viewer/src/main.ts.
const POLL_MS = 60_000

/** The stage's slot of a recorded frame of the test `id`, on the side `before` says. */
function slotOf(id, { frame, removed, before = false }) {
  const place = removed === undefined ? `[data-frame="${frame}"]` : `[data-removed="${removed}"]`
  const side = before ? '[data-side="before"]' : ':not([data-side])'

  return `.stage-slot[data-test="${id}"]${place}${side}:not(.incoming):not(.live-underlay)`
}

/** Waits until the stage shows `slot`. A problem or `null`. */
async function showsSlot(page, slot, step) {
  const shown = await page
    .locator(`${slot} iframe`)
    .waitFor({ state: 'visible', timeout: VIEWER_TIMEOUT })
    .then(() => true)
    .catch(() => false)

  if (shown) {
    return null
  }

  const slots = await page.$$eval('.stage-slot', (all) =>
    all.map((candidate) => JSON.stringify({ ...candidate.dataset })),
  )

  return `${step}: the stage does not show ${slot}, its slots are ${slots.join(' ') || 'none'}`
}

/** The computed height of the Upgrade button in the frame of `slot`. */
function upgradeHeight(page, slot) {
  return page.evaluate(
    ({ target, text }) => {
      const frameDocument = document.querySelector(`${target} iframe`)?.contentDocument
      const button = Array.from(frameDocument?.querySelectorAll('button') ?? []).find(
        (candidate) => candidate.textContent?.trim() === text,
      )

      return button ? frameDocument.defaultView.getComputedStyle(button).height : null
    },
    { target: slot, text: UPGRADE },
  )
}

/** Whether a stylesheet of the frame of `slot` has a rule with exactly `selector`, nested ones too. */
function hasRule(page, slot, selector) {
  return page.evaluate(
    ({ target, wanted }) => {
      const frameDocument = document.querySelector(`${target} iframe`)?.contentDocument
      const holds = (rules) =>
        Array.from(rules).some(
          (rule) =>
            rule.selectorText === wanted ||
            (rule.cssRules !== undefined && holds(rule.cssRules)) ||
            (rule.styleSheet?.cssRules !== undefined && holds(rule.styleSheet.cssRules)),
        )

      return Array.from(frameDocument?.styleSheets ?? []).some((sheet) => {
        try {
          return holds(sheet.cssRules)
        } catch {
          return false
        }
      })
    },
    { target: slot, wanted: selector },
  )
}

/** A problem when the frame of `slot` does not paint the Upgrade button at `height` with or without the new rule. */
async function paintsProblem(page, slot, height, rule, step) {
  const painted = {
    height: await upgradeHeight(page, slot),
    rule: await hasRule(page, slot, NEW_RULE),
  }

  return painted.height === height && painted.rule === rule
    ? null
    : `${step}: the Upgrade button is ${painted.height} and ${NEW_RULE} is ${painted.rule ? '' : 'not '}a rule, expected ${height} and ${rule ? '' : 'no '}rule`
}

/** The switch's buttons, each as `side pressed disabled`. */
function switchState(page) {
  return page.$$eval('.before-after button', (buttons) =>
    buttons.map(
      (button) =>
        `${button.dataset.side} ${button.getAttribute('aria-pressed')} ${button.getAttribute('aria-disabled') ?? 'enabled'}`,
    ),
  )
}

/** A problem when the switch is hidden or its buttons are not `expected`. */
async function switchProblem(page, expected, step) {
  const visible = await page.locator('.before-after').isVisible()
  const shown = await switchState(page)

  if (visible && JSON.stringify(shown) === JSON.stringify(expected)) {
    return null
  }

  return `${step}: the switch is ${visible ? 'shown' : 'hidden'} with ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`
}

async function labeled(step, problem) {
  const found = await problem

  return found === null ? null : `${step}: ${found}`
}

/** The zoom the toolbar shows and the on-screen width of the frame of `slot`. */
function zoomAndWidth(page, slot) {
  return page.evaluate(
    (target) => ({
      zoom: document.querySelector('.crumbs .tools .zoom')?.textContent ?? '',
      width: Math.round(
        document.querySelector(`${target} iframe`)?.getBoundingClientRect().width ?? 0,
      ),
    }),
    slot,
  )
}

/** Requests under `__base/snapshots/`, and those that failed. */
function watchBaseSnapshots(page) {
  const seen = { requested: [], failed: [] }
  const underBase = (request) => new URL(request.url()).pathname.includes('/__base/snapshots/')

  page.on('request', (request) => {
    if (underBase(request)) {
      seen.requested.push(new URL(request.url()).pathname)
    }
  })

  page.on('requestfailed', (request) => {
    if (underBase(request)) {
      seen.failed.push(new URL(request.url()).pathname)
    }
  })

  page.on('response', (response) => {
    if (underBase(response.request()) && response.status() >= 400) {
      seen.failed.push(`${response.status()} for ${new URL(response.url()).pathname}`)
    }
  })

  return seen
}

/** The inspector's frame section, the props its component section lists and its key hint. */
function inspectorOf(page) {
  return page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('#inspector > section'))
    const heading = (section) => section.querySelector('h3')?.textContent ?? ''
    const frame = sections.find((section) => /^(frame |removed frame)/.test(heading(section)))
    const component = sections.find((section) => heading(section).startsWith('component'))

    return {
      heading: frame === undefined ? null : heading(frame),
      label: frame?.querySelector('.mono')?.textContent ?? null,
      hint: frame?.querySelector('.hint')?.textContent ?? null,
      props: Array.from(component?.querySelectorAll('table.kv tr > td:first-child') ?? []).map(
        (cell) => cell.textContent,
      ),
      keys: sections.at(-1)?.textContent ?? '',
    }
  })
}

/**
 * A problem when the inspector does not show the fields of `expected`.
 * `sideKey` says whether its key hint names `B`.
 */
async function inspectorProblem(page, expected, step) {
  const shown = await inspectorOf(page)
  const { keys, ...fields } = shown
  const seen = { ...fields, sideKey: keys.includes(SIDE_KEY) }
  const wrong = Object.keys(expected).filter(
    (key) => JSON.stringify(seen[key]) !== JSON.stringify(expected[key]),
  )

  return wrong.length === 0
    ? null
    : `${step}: the inspector shows ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`
}

/** The boxes of the crumbs row, its path, its zoom and its inspector toggle, in window pixels. */
function rowOf(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()

      return rect === undefined
        ? null
        : { left: Math.round(rect.left), right: Math.round(rect.right) }
    }

    return {
      row: box('.main .crumbs'),
      path: box('.main .crumbs .path'),
      zoom: box('.main .crumbs .zoom'),
      zoomText: document.querySelector('.main .crumbs .zoom')?.textContent ?? '',
      toggle: box('.main .crumbs .panel-toggle [data-panel="inspector"]'),
    }
  })
}

/**
 * A problem when, at this window width, the crumbs row leaves the path no
 * width or clips the zoom or the inspector toggle.
 */
async function rowProblem(page, width, step) {
  await page.setViewportSize({ width, height: 800 })
  await page.waitForTimeout(SETTLE_MS)

  const { row, path, zoom, zoomText, toggle } = await rowOf(page)
  const fits =
    path.right > path.left &&
    zoomText !== '' &&
    zoom.right <= row.right &&
    toggle !== null &&
    toggle.right <= row.right

  return fits
    ? null
    : `${step} at ${width} px: the crumbs row is ${JSON.stringify({ row, path, zoom, zoomText, toggle })}, expected a path wider than 0 and the zoom and the inspector toggle inside the row`
}

/** Waits until the stage says that the base frame did not load, with no Before slot. */
async function baseMissingProblem(page, step) {
  const said = await page
    .locator('.stage .empty', { hasText: BASE_MISSING })
    .waitFor({ timeout: VIEWER_TIMEOUT })
    .then(() => true)
    .catch(() => false)

  const before = await page.locator('.stage-slot[data-side="before"]').count()

  return said && before === 0
    ? null
    : `${step}: the stage ${said ? 'says' : 'does not say'} "${BASE_MISSING}" and has ${before} Before slots`
}

/** The frame with its base side moved one index on, when it is at `from` or later. */
function shifted(frame, from) {
  if (frame.base === undefined || frame.base.index < from) {
    return frame
  }

  return { ...frame, base: { ...frame.base, index: frame.base.index + 1 } }
}

/**
 * 1 to 5: Card's switch, a click, `B`, the inspector, the zoom at a wide
 * viewport and a fresh `before=1`. `baseLabel` is the report's label of the
 * base side.
 */
async function switchSteps(page, url, card, baseLabel) {
  const after = slotOf(card, { frame: 0 })
  const before = slotOf(card, { frame: 0, before: true })
  const baseSnapshots = watchBaseSnapshots(page)
  const wideZoom = {}

  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#test=${card}&live=0`)

      return (
        (await showsSlot(page, after, 'Card')) ??
        (await switchProblem(page, ['before false enabled', 'after true enabled'], 'Card')) ??
        (await paintsProblem(page, after, AFTER_HEIGHT, true, 'Card on After')) ??
        (await inspectorProblem(page, { heading: 'frame 1 / 1', sideKey: true }, 'Card on After'))
      )
    },
    async () => {
      const requestedBefore = baseSnapshots.requested.length

      await page.locator('.before-after [data-side="before"]').click()

      const problem =
        (await showsSlot(page, before, 'a click on Before')) ??
        (await labeled(
          'a click on Before',
          linkProblem(page, { test: card, live: '0', before: '1' }),
        )) ??
        (await paintsProblem(page, before, BEFORE_HEIGHT, false, 'Card on Before')) ??
        (await inspectorProblem(
          page,
          {
            heading: 'frame 1 / 1 · before',
            label: baseLabel,
            hint: 'in the base run',
            sideKey: true,
          },
          'Card on Before',
        ))

      if (problem !== null) {
        return problem
      }

      if (baseSnapshots.requested.length <= requestedBefore || baseSnapshots.failed.length > 0) {
        return `Before requested ${baseSnapshots.requested.length - requestedBefore} files under __base/snapshots/, and these failed: ${baseSnapshots.failed.join(', ') || 'none'}`
      }

      return null
    },
    async () => {
      await pressInViewer(page, 'b')

      return (
        (await showsSlot(page, after, 'B on Before')) ??
        (await paintsProblem(page, after, AFTER_HEIGHT, true, 'B on Before')) ??
        (await labeled('B on Before', linkProblem(page, { test: card, live: '0', before: null })))
      )
    },
    async () => {
      await freshLoad(page, `${url}#test=${card}&live=0&w=${WIDE}`)

      const problem = await showsSlot(page, after, `w=${WIDE}`)

      if (problem !== null) {
        return problem
      }

      // The swap fits the frame once more when its fonts settle.
      await page.waitForTimeout(SETTLE_MS)
      wideZoom.after = await zoomAndWidth(page, after)
      await page.locator('.before-after [data-side="before"]').click()

      return showsSlot(page, before, `Before at w=${WIDE}`)
    },
    async () => {
      await page.waitForTimeout(SETTLE_MS)
      wideZoom.before = await zoomAndWidth(page, before)

      const same = JSON.stringify(wideZoom.after) === JSON.stringify(wideZoom.before)

      return same && wideZoom.after.zoom !== ''
        ? null
        : `at w=${WIDE}, After shows ${JSON.stringify(wideZoom.after)} and Before ${JSON.stringify(wideZoom.before)}, expected the same zoom below 100% and the same width`
    },
    async () => {
      await freshLoad(page, `${url}#test=${card}&live=0&before=1`)

      return (
        (await showsSlot(page, before, 'a fresh before=1')) ??
        (await paintsProblem(page, before, BEFORE_HEIGHT, false, 'a fresh before=1'))
      )
    },
  ])
}

/**
 * The toolbar with the switch and a zoom, on both sides: at 1280 and 1366 px
 * with both panels open the row keeps the path, the zoom and the inspector
 * toggle, and at 390 px the switch stays in the window.
 */
async function rowSteps(page, url, card) {
  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#test=${card}&live=0&w=${WIDE}`)

      return (
        (await showsSlot(page, slotOf(card, { frame: 0 }), `w=${WIDE}`)) ??
        (await rowProblem(page, ROW_WIDTHS[0], 'After'))
      )
    },
    async () => {
      await page.locator('.before-after [data-side="before"]').click()

      const problem = await showsSlot(page, slotOf(card, { frame: 0, before: true }), 'Before')

      if (problem !== null) {
        return problem
      }

      for (const width of ROW_WIDTHS) {
        const row = await rowProblem(page, width, 'Before')

        if (row !== null) {
          return row
        }
      }

      return null
    },
    async () => {
      await page.setViewportSize({ width: NARROW, height: 800 })
      await page.waitForTimeout(SETTLE_MS)

      const box = await page.evaluate(() => {
        const rect = document.querySelector('.before-after')?.getBoundingClientRect()

        return rect === undefined ? null : { left: rect.left, right: rect.right, width: rect.width }
      })

      return box !== null && box.width > 0 && box.left >= 0 && box.right <= NARROW
        ? null
        : `at ${NARROW} px the switch is at ${JSON.stringify(box)}, outside the window`
    },
  ])
}

/** 6 and 7: another frame and another test show After, and Live has no switch. */
async function leavingSteps(page, url, card, submits) {
  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#test=${submits}&live=0&before=1`)

      const problem = await showsSlot(
        page,
        slotOf(submits, { frame: 0, before: true }),
        'SignupCard',
      )

      if (problem !== null) {
        return problem
      }

      await pressInViewer(page, 'ArrowRight')

      return (
        (await showsSlot(page, slotOf(submits, { frame: 1 }), '→ on Before')) ??
        (await labeled(
          '→ on Before',
          linkProblem(page, { test: submits, frame: '1', before: null }),
        ))
      )
    },
    async () => {
      await pressInViewer(page, 'b')

      const problem = await showsSlot(
        page,
        slotOf(submits, { frame: 1, before: true }),
        'B on frame 1',
      )

      if (problem !== null) {
        return problem
      }

      await page.locator(`.tree .test[title="${CARD}"]`).click()

      return (
        (await showsSlot(page, slotOf(card, { frame: 0 }), 'Card from the sidebar on Before')) ??
        (await labeled(
          'Card from the sidebar on Before',
          linkProblem(page, { test: card, live: '0', before: null }),
        ))
      )
    },
    async () => {
      await freshLoad(page, `${url}#test=${card}`)

      const live = page.locator(`.stage-slot.live-slot[data-test="${card}"]`)
      const mounted = await live
        .waitFor({ state: 'attached', timeout: LIVE_TIMEOUT })
        .then(() => true)
        .catch(() => false)

      if (!mounted) {
        return `#test=${card} does not open Live`
      }

      if (await page.locator('.before-after').isVisible()) {
        return 'the switch shows in Live'
      }

      await pressInViewer(page, 'b')
      await page.waitForTimeout(SETTLE_MS)

      if ((await live.count()) !== 1) {
        return 'B in Live took the live slot off the stage'
      }

      return labeled('B in Live', linkProblem(page, { test: card, live: null, before: null }))
    },
    async () => {
      await pressInViewer(page, 'ArrowLeft')

      return (
        (await showsSlot(page, slotOf(card, { frame: 0 }), '← in Live')) ??
        (await switchProblem(page, ['before false enabled', 'after true enabled'], '← in Live'))
      )
    },
  ])
}

/** Whether the frame of `slot` has the marker of `run` in its head. */
function hasMarker(page, slot, run) {
  return page.evaluate(
    ({ target, name, content }) =>
      document
        .querySelector(`${target} iframe`)
        ?.contentDocument?.querySelector(`meta[name="${name}"][content="${content}"]`) != null,
    { target: slot, name: MARKER, content: run },
  )
}

function withMarker(manifest, run) {
  return { ...manifest, head: `${manifest.head ?? ''}<meta name="${MARKER}" content="${run}">` }
}

/** 8: each side replays with the preview head of its own run. */
async function headSteps(page, url, card) {
  const sides = {
    After: slotOf(card, { frame: 0 }),
    Before: slotOf(card, { frame: 0, before: true }),
  }

  await freshLoad(page, `${url}#test=${card}&live=0`)

  for (const [side, slot] of Object.entries(sides)) {
    if (side === 'Before') {
      await page.locator('.before-after [data-side="before"]').click()
    }

    const problem = await showsSlot(page, slot, side)

    if (problem !== null) {
      return problem
    }

    const markers = {
      data: await hasMarker(page, slot, 'data'),
      base: await hasMarker(page, slot, 'base'),
    }

    const expected = side === 'Before' ? { data: false, base: true } : { data: true, base: false }

    if (JSON.stringify(markers) !== JSON.stringify(expected)) {
      return `${side}'s head has the markers ${JSON.stringify(markers)}, expected ${JSON.stringify(expected)}`
    }
  }

  return null
}

/** The test of `manifest` named `fullName`, to edit in place. */
function testIn(manifest, fullName) {
  const test = manifest.modules
    .flatMap((mod) => mod.tests)
    .find((candidate) => candidate.fullName === fullName)

  if (test === undefined) {
    throw new Error(`the manifest has no test "${fullName}"`)
  }

  return test
}

/**
 * The routed pair with a removed frame: the base manifest gets a frame at
 * index 1 of SignupCard's submit test with the snapshot of its last frame,
 * and the report the frame as removed, with the later base indices shifted.
 * `routedPair()` already left out the change of head frame 0, so the removed
 * frame is the first change. The report gives the base side of frame 1 a
 * label of its own, and frame 0 of the routed manifest gets one more prop.
 */
function routedRemoved(report, manifest, baseManifest) {
  const { routedReport, routedManifest } = routedPair(report, manifest)
  const routedBase = structuredClone(baseManifest)
  const baseTest = testIn(routedBase, SUBMITS)
  const snapshot = baseTest.frames.at(-1).snapshot

  baseTest.frames.splice(REMOVED_FRAME.index, 0, {
    ...baseTest.frames.at(-1),
    id: 'routed-removed',
    kind: REMOVED_FRAME.kind,
    label: REMOVED_FRAME.label,
    at: REMOVED_FRAME.at,
    snapshot,
  })

  const firstFrame = testIn(routedManifest, SUBMITS).frames[0]

  firstFrame.meta = {
    ...firstFrame.meta,
    props: { ...firstFrame.meta?.props, [FRAME_PROP]: 'frame 0 only' },
  }

  const removed = {
    change: 'removed',
    base: { index: REMOVED_FRAME.index, label: REMOVED_FRAME.label, snapshot },
  }

  const relabeled = (frame) =>
    frame.head?.index === 1 ? { ...frame, base: { ...frame.base, label: BASE_LABEL } } : frame

  const tests = routedReport.tests.map((entry) =>
    entry.fullName === SUBMITS
      ? {
          ...entry,
          frames: [
            removed,
            ...entry.frames.map((frame) => relabeled(shifted(frame, REMOVED_FRAME.index))),
          ],
        }
      : entry,
  )

  return { routedReport: { ...routedReport, tests }, routedManifest, routedBase }
}

/**
 * The routed pair with a removed frame at the start of Card, the first test
 * the Changed filter leaves: the base manifest gets a copy of Card's frame
 * first, and the report the frame as removed.
 */
function routedFallback(report, manifest, baseManifest) {
  const { routedReport, routedManifest } = routedPair(report, manifest)
  const routedBase = structuredClone(baseManifest)
  const baseCard = testIn(routedBase, CARD)

  baseCard.frames.unshift({
    ...baseCard.frames[0],
    id: 'routed-first',
    label: FIRST_REMOVED_LABEL,
  })

  const removed = {
    change: 'removed',
    base: { index: 0, label: FIRST_REMOVED_LABEL, snapshot: baseCard.frames[0].snapshot },
  }

  const tests = routedReport.tests.map((entry) =>
    entry.fullName === CARD
      ? { ...entry, frames: [removed, ...entry.frames.map((frame) => shifted(frame, 0))] }
      : entry,
  )

  return { routedReport: { ...routedReport, tests }, routedManifest, routedBase }
}

/** 9: an added frame has only After, so neither a click on Before nor `B` leaves it. */
async function addedSteps(page, url, rejects) {
  const after = slotOf(rejects, { frame: 0 })

  await freshLoad(page, `${url}#test=${rejects}&live=0`)

  const shown =
    (await showsSlot(page, after, 'the added test')) ??
    (await switchProblem(page, ['before false true', 'after true enabled'], 'the added test')) ??
    (await inspectorProblem(page, { sideKey: false }, 'the added test'))

  if (shown !== null) {
    return shown
  }

  // `force`, because Playwright takes `aria-disabled` for disabled and would wait.
  await page.locator('.before-after [data-side="before"]').click({ force: true })
  await pressInViewer(page, 'b')
  await page.waitForTimeout(SETTLE_MS)

  return (
    (await showsSlot(page, after, 'Before and B on the added frame')) ??
    (await labeled(
      'Before and B on the added frame',
      linkProblem(page, { test: rejects, live: '0', before: null }),
    ))
  )
}

/** The timeline's second entry, as the removed frame would show it. */
function secondEntry(page) {
  return page.$eval('.timeline .frame:nth-child(2)', (entry) => ({
    removed: entry.dataset.removed ?? null,
    change: entry.dataset.change ?? null,
    kind: entry.querySelector('.k')?.textContent ?? null,
    step: entry.classList.contains('step'),
    label: entry.querySelector('.label')?.textContent ?? null,
    time: entry.querySelector('.t')?.textContent ?? null,
    pill: entry.querySelector('.change-pill')?.textContent ?? null,
  }))
}

/**
 * 10: the removed frame in the timeline, its link, the inspector, ← → around
 * it, the base label on Before and the Changed filter. `props` are the names
 * of the test's component props.
 */
async function removedSteps(page, url, submits, props) {
  const removed = slotOf(submits, { removed: REMOVED_FRAME.index, before: true })
  const removedLink = { test: submits, removed: '1', frame: null, live: null, before: null }

  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#test=${submits}&live=0`)
      await page.locator('.timeline .frame.removed').waitFor({ timeout: VIEWER_TIMEOUT })

      const shown = await secondEntry(page)
      const expected = {
        removed: '1',
        change: 'removed',
        kind: REMOVED_FRAME.kind,
        step: true,
        label: REMOVED_FRAME.label,
        time: `${REMOVED_FRAME.at}ms`,
        pill: 'gone',
      }

      return JSON.stringify(shown) === JSON.stringify(expected)
        ? null
        : `the timeline's second entry is ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`
    },
    async () => {
      await page.locator('.timeline .frame.removed').click()

      return (
        (await showsSlot(page, removed, 'a click on the removed frame')) ??
        (await labeled('a click on the removed frame', linkProblem(page, removedLink))) ??
        (await switchProblem(
          page,
          ['before true enabled', 'after false true'],
          'the removed frame',
        )) ??
        (await inspectorProblem(
          page,
          {
            heading: 'removed frame',
            label: REMOVED_FRAME.label,
            hint: 'in the base run, not in this one',
            props,
            sideKey: false,
          },
          'the removed frame',
        ))
      )
    },
    async () => {
      await pressInViewer(page, 'ArrowLeft')

      return (
        (await showsSlot(page, slotOf(submits, { frame: 0 }), '← from the removed frame')) ??
        (await labeled(
          '← from the removed frame',
          linkProblem(page, { test: submits, live: '0', removed: null }),
        )) ??
        (await inspectorProblem(
          page,
          { heading: 'frame 1 / 3', props: [...props, FRAME_PROP] },
          '← from the removed frame',
        ))
      )
    },
    async () => {
      await pressInViewer(page, 'ArrowRight')

      return (
        (await showsSlot(page, removed, '→ from frame 0')) ??
        (await labeled('→ from frame 0', linkProblem(page, removedLink)))
      )
    },
    async () => {
      await pressInViewer(page, 'ArrowRight')

      return (
        (await showsSlot(page, slotOf(submits, { frame: 1 }), '→ from the removed frame')) ??
        (await labeled(
          '→ from the removed frame',
          linkProblem(page, { test: submits, frame: '1', removed: null }),
        ))
      )
    },
    async () => {
      await pressInViewer(page, 'b')

      return (
        (await showsSlot(page, slotOf(submits, { frame: 1, before: true }), 'B on frame 1')) ??
        (await inspectorProblem(
          page,
          {
            heading: 'frame 2 / 3 · before',
            label: BASE_LABEL,
            hint: 'in the base run',
            sideKey: true,
          },
          'B on frame 1',
        ))
      )
    },
    async () => {
      await freshLoad(page, `${url}#test=${submits}&removed=1`)

      return (
        (await showsSlot(page, removed, 'a fresh removed=1')) ??
        (await labeled('a fresh removed=1', linkProblem(page, removedLink)))
      )
    },
    async () => {
      await freshLoad(page, `${url}#changed=1`)
      await page.locator(`.tree .test[title="${SUBMITS}"]`).click()

      return (
        (await showsSlot(page, removed, 'a click under the Changed filter')) ??
        (await labeled(
          'a click under the Changed filter',
          linkProblem(page, { ...removedLink, changed: '1' }),
        ))
      )
    },
  ])
}

/** 11: a side the report does not have drops out of the link. */
async function droppedSteps(page, url, card, unmarked) {
  const links = [
    [`#test=${unmarked}&before=1`, { test: unmarked, live: '0', before: null }],
    [`#test=${card}&removed=5`, { test: card, live: '0', removed: null }],
  ]

  for (const [hash, expected] of links) {
    await freshLoad(page, `${url}${hash}`)
    await page.waitForTimeout(SETTLE_MS)

    const problem = await linkProblem(page, expected)

    if (problem !== null) {
      return `${hash}: ${problem}`
    }
  }

  return null
}

/**
 * A base snapshot that does not load, then a base manifest that does not
 * load: the stage says so, the page throws nothing and `B` shows After.
 * Aborted rather than answered with an error status, which the page's
 * failures would count.
 */
async function failureSteps(page, url, card, snapshot) {
  const gate = { snapshot: true, manifest: false }

  await page.route(`**/__base/${snapshot}`, (route) =>
    gate.snapshot ? route.abort() : route.fallback(),
  )

  await page.route('**/__base/manifest.json', (route) =>
    gate.manifest ? route.abort() : route.fallback(),
  )

  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#test=${card}&live=0&before=1`)

      return baseMissingProblem(page, 'a base snapshot that does not load')
    },
    async () => {
      await pressInViewer(page, 'b')

      return (
        (await showsSlot(page, slotOf(card, { frame: 0 }), 'B on a base that did not load')) ??
        (await labeled(
          'B on a base that did not load',
          linkProblem(page, { test: card, live: '0', before: null }),
        ))
      )
    },
    async () => {
      gate.snapshot = false
      gate.manifest = true
      await freshLoad(page, `${url}#test=${card}&live=0&before=1`)

      return baseMissingProblem(page, 'a base manifest that does not load')
    },
    async () => {
      await pressInViewer(page, 'b')

      return showsSlot(page, slotOf(card, { frame: 0 }), 'B on a base manifest that did not load')
    },
  ])
}

/**
 * A base manifest that does not load is fetched again on the static site's
 * next poll, which the page's clock brings forward. A poll that fails again
 * repaints nothing, and the one that loads it shows Before.
 */
async function retrySteps(page, url, card) {
  const gate = { fail: true }
  const requests = []

  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/__base/manifest.json')) {
      requests.push(request.url())
    }
  })

  await page.route('**/__base/manifest.json', (route) =>
    gate.fail ? route.abort() : route.fallback(),
  )

  await page.clock.install()

  return firstProblem([
    async () => {
      await freshLoad(page, `${url}#test=${card}&live=0&before=1`)

      const problem = await baseMissingProblem(page, 'a base manifest that does not load')

      if (problem !== null) {
        return problem
      }

      // A repaint replaces both, so the marks show whether a poll repainted.
      await page.evaluate(() => {
        document.querySelector('.stage .empty').dataset.check = 'first paint'
        document.querySelector('.tree').dataset.check = 'first paint'
      })

      return null
    },
    async () => {
      const asked = requests.length

      await page.clock.fastForward(POLL_MS)
      await page.waitForTimeout(SETTLE_MS)

      const kept = await page.evaluate(
        () =>
          document.querySelector('.stage .empty')?.dataset.check === 'first paint' &&
          document.querySelector('.tree')?.dataset.check === 'first paint',
      )

      return requests.length > asked && kept
        ? null
        : `a poll whose base manifest fails again asked for it ${requests.length - asked} times and ${kept ? 'kept' : 'repainted'} the view`
    },
    async () => {
      gate.fail = false
      await page.clock.fastForward(POLL_MS)

      const before = slotOf(card, { frame: 0, before: true })

      return (
        (await showsSlot(page, before, 'the poll that loads the base manifest')) ??
        (await paintsProblem(page, before, BEFORE_HEIGHT, false, 'the poll that loads it'))
      )
    },
  ])
}

/** `#changed=1` alone opens the first test the filter leaves on its removed frame, its first change. */
async function fallbackSteps(page, url, card) {
  await freshLoad(page, `${url}#changed=1`)

  return (
    (await showsSlot(page, slotOf(card, { removed: 0, before: true }), '#changed=1')) ??
    (await labeled(
      '#changed=1',
      linkProblem(page, {
        test: card,
        changed: '1',
        removed: '0',
        frame: null,
        live: null,
        before: null,
      }),
    ))
  )
}

function json(body) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) }
}

/**
 * The shadcn pair site served at `url`: Before and After on the real report,
 * the toolbar's row, the preview head of each run and a base that does not
 * load, then an added frame, a removed frame, links with sides the report
 * does not have and the Changed filter's first change, on a routed report and
 * base manifest.
 */
export async function checkBeforeAfter(browser, url, { report, manifest, baseManifest }) {
  const label = 'the shadcn pair site'
  const card = testOf(manifest, CARD).id
  const submits = testOf(manifest, SUBMITS).id
  const cardBase = entryOf(report, CARD).frames[0]?.base

  if (cardBase === undefined) {
    return [`${label}: the report has no base side for the first frame of ${CARD}`]
  }

  const switched = await onPage(browser, url, `${label} Before / After`, (page) =>
    switchSteps(page, url, card, cardBase.label),
  )

  if (switched.length === 0) {
    console.log(
      `check-site: the shadcn pair site's Before / After switch shows on Card with After pressed, the Upgrade button is ${AFTER_HEIGHT} with the ${NEW_RULE} rule on After, Before replays the base run's frame from __base/snapshots/ with the button at ${BEFORE_HEIGHT} and no such rule and the inspector says frame 1 / 1 · before with the base run's label, a click, B and before=1 in the link switch the sides at the same zoom and width, and a fresh link with before=1 opens Before`,
    )
  }

  const rows = await onPage(browser, url, `${label} toolbar`, (page) => rowSteps(page, url, card))

  if (rows.length === 0) {
    console.log(
      `check-site: the shadcn pair site's toolbar with the switch and a zoom keeps the path, the zoom and the inspector toggle in its row at ${ROW_WIDTHS.join(' and ')} px with both panels open, on After and on Before, and the switch in the window at ${NARROW} px`,
    )
  }

  const leaving = await onPage(browser, url, `${label} leaving Before`, (page) =>
    leavingSteps(page, url, card, submits),
  )

  if (leaving.length === 0) {
    console.log(
      'check-site: the shadcn pair site shows After for the next frame by → and for another test from the sidebar, has no switch in Live, where B leaves the live frame and the link alone, and shows the switch with After pressed once ← leaves Live',
    )
  }

  const heads = await onPage(browser, url, `${label} preview heads`, async (page) => {
    await page.route('**/__data/manifest.json', (route) =>
      route.fulfill(json(withMarker(manifest, 'data'))),
    )

    await page.route('**/__base/manifest.json', (route) =>
      route.fulfill(json(withMarker(baseManifest, 'base'))),
    )

    return headSteps(page, url, card)
  })

  if (heads.length === 0) {
    console.log(
      "check-site: the shadcn pair site replays Before with the base run's preview head and After with this run's",
    )
  }

  const failed = await onPage(browser, url, `${label} a base that does not load`, (page) =>
    failureSteps(page, url, card, cardBase.snapshot),
  )

  if (failed.length === 0) {
    console.log(
      `check-site: the shadcn pair site says ${BASE_MISSING} for a base snapshot and for a base manifest that do not load, throws nothing and shows After on B`,
    )
  }

  const retried = await onPage(browser, url, `${label} a base manifest loaded later`, (page) =>
    retrySteps(page, url, card),
  )

  if (retried.length === 0) {
    console.log(
      'check-site: the shadcn pair site asks again on the next poll for a base manifest that did not load, repaints nothing while it still fails and shows Before once it loads',
    )
  }

  const { routedReport, routedManifest, routedBase } = routedRemoved(report, manifest, baseManifest)
  const props = Object.keys(testOf(routedManifest, SUBMITS).component?.props ?? {})
  const routed = await onPage(browser, url, `${label} routed sides`, async (page) => {
    await page.route('**/__data/changes.json', (route) => route.fulfill(json(routedReport)))
    await page.route('**/__data/manifest.json', (route) => route.fulfill(json(routedManifest)))
    await page.route('**/__base/manifest.json', (route) => route.fulfill(json(routedBase)))

    return firstProblem([
      () => addedSteps(page, url, testOf(routedManifest, REJECTS).id),
      () => removedSteps(page, url, submits, props),
      () => droppedSteps(page, url, card, testOf(routedManifest, UNMARKED_INPUT).id),
    ])
  })

  if (routed.length === 0) {
    console.log(
      `check-site: the shadcn pair site with a routed report disables Before on an added frame, where a click and B keep After and the inspector names no B, shows a removed frame second in SignupCard's timeline as gone with its kind and time, opens it with only removed=1 in the link and only Before, and the inspector says removed frame with the test's props, steps to it and past it with ← →, shows the base side's own label on Before, opens it from a link and under the Changed filter, and drops before=1 on an unmarked test and removed=5 on Card from the link`,
    )
  }

  const fallback = routedFallback(report, manifest, baseManifest)
  const opened = await onPage(browser, url, `${label} first change`, async (page) => {
    await page.route('**/__data/changes.json', (route) =>
      route.fulfill(json(fallback.routedReport)),
    )

    await page.route('**/__data/manifest.json', (route) =>
      route.fulfill(json(fallback.routedManifest)),
    )

    await page.route('**/__base/manifest.json', (route) => route.fulfill(json(fallback.routedBase)))

    return fallbackSteps(page, url, card)
  })

  if (opened.length === 0) {
    console.log(
      'check-site: the shadcn pair site opens #changed=1 alone on removed=0 of Card, the first test the filter leaves, when a removed frame is its first change',
    )
  }

  return [...switched, ...rows, ...leaving, ...heads, ...failed, ...retried, ...routed, ...opened]
}
