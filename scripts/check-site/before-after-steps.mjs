/**
 * check-site's cases of Before and After on the shadcn pair site, which
 * `describe-me build --base --live` builds. On the real report: the switch on
 * Card, a click, `B` and `before=1`, the same zoom and width on both sides,
 * another frame, another test, Live, and the preview head of each run. With a
 * routed report and base manifest: an added frame, a removed frame in the
 * timeline, and links that name a side the report does not have.
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
const MARKER = 'describe-me-check'
// The frame the routed report says this run lost, between frames 0 and 1 of SignupCard's submit test.
const REMOVED_FRAME = { index: 1, kind: 'step', label: 'a step this run no longer takes', at: 4242 }

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

/** 1 to 5: Card's switch, a click, `B`, the zoom at a wide viewport and a fresh `before=1`. */
async function switchSteps(page, url, card) {
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
        (await paintsProblem(page, after, AFTER_HEIGHT, true, 'Card on After'))
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
        (await paintsProblem(page, before, BEFORE_HEIGHT, false, 'Card on Before'))

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

/**
 * The routed pair with a removed frame: the base manifest gets a frame at
 * index 1 of SignupCard's submit test with the snapshot of its last frame,
 * and the report the frame as removed, with the later base indices shifted.
 * `routedPair()` already left out the change of head frame 0, so the removed
 * frame is the first change.
 */
function routedRemoved(report, manifest, baseManifest) {
  const { routedReport, routedManifest } = routedPair(report, manifest)
  const routedBase = structuredClone(baseManifest)
  const baseTest = routedBase.modules
    .flatMap((mod) => mod.tests)
    .find((test) => test.fullName === SUBMITS)

  if (baseTest === undefined) {
    throw new Error(`the base manifest has no test "${SUBMITS}"`)
  }

  const snapshot = baseTest.frames.at(-1).snapshot

  baseTest.frames.splice(REMOVED_FRAME.index, 0, {
    ...baseTest.frames.at(-1),
    id: 'routed-removed',
    kind: REMOVED_FRAME.kind,
    label: REMOVED_FRAME.label,
    at: REMOVED_FRAME.at,
    snapshot,
  })

  const shift = (frame) =>
    frame.base === undefined || frame.base.index < REMOVED_FRAME.index
      ? frame
      : { ...frame, base: { ...frame.base, index: frame.base.index + 1 } }

  const removed = {
    change: 'removed',
    base: { index: REMOVED_FRAME.index, label: REMOVED_FRAME.label, snapshot },
  }

  const tests = routedReport.tests.map((entry) =>
    entry.fullName === SUBMITS
      ? { ...entry, frames: [removed, ...entry.frames.map(shift)] }
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
    (await switchProblem(page, ['before false true', 'after true enabled'], 'the added test'))

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

/** 10: the removed frame in the timeline, its link, ← → around it and the Changed filter. */
async function removedSteps(page, url, submits) {
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

function json(body) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) }
}

/**
 * The shadcn pair site served at `url`: Before and After on the real report,
 * the preview head of each run, then an added frame, a removed frame and
 * links with sides the report does not have, on a routed report and base
 * manifest.
 */
export async function checkBeforeAfter(browser, url, { report, manifest, baseManifest }) {
  const label = 'the shadcn pair site'
  const card = testOf(manifest, CARD).id
  const submits = testOf(manifest, SUBMITS).id

  if (entryOf(report, CARD).frames.length === 0) {
    return [`${label}: the report marks no frame of ${CARD}`]
  }

  const switched = await onPage(browser, url, `${label} Before / After`, (page) =>
    switchSteps(page, url, card),
  )

  if (switched.length === 0) {
    console.log(
      `check-site: the shadcn pair site's Before / After switch shows on Card with After pressed, the Upgrade button is ${AFTER_HEIGHT} with the ${NEW_RULE} rule on After, Before replays the base run's frame from __base/snapshots/ with the button at ${BEFORE_HEIGHT} and no such rule, a click, B and before=1 in the link switch the sides at the same zoom and width, and a fresh link with before=1 opens Before`,
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

  const { routedReport, routedManifest, routedBase } = routedRemoved(report, manifest, baseManifest)
  const routed = await onPage(browser, url, `${label} routed sides`, async (page) => {
    await page.route('**/__data/changes.json', (route) => route.fulfill(json(routedReport)))
    await page.route('**/__data/manifest.json', (route) => route.fulfill(json(routedManifest)))
    await page.route('**/__base/manifest.json', (route) => route.fulfill(json(routedBase)))

    return firstProblem([
      () => addedSteps(page, url, testOf(routedManifest, REJECTS).id),
      () => removedSteps(page, url, submits),
      () => droppedSteps(page, url, card, testOf(routedManifest, UNMARKED_INPUT).id),
    ])
  })

  if (routed.length === 0) {
    console.log(
      `check-site: the shadcn pair site with a routed report disables Before on an added frame, where a click and B keep After, shows a removed frame second in SignupCard's timeline as gone with its kind and time, opens it with only removed=1 in the link and only Before, steps to it and past it with ← →, opens it from a link and under the Changed filter, and drops before=1 on an unmarked test and removed=5 on Card from the link`,
    )
  }

  return [...switched, ...leaving, ...heads, ...routed]
}
