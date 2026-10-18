/**
 * The Chromium part of check-foundations. Every output gets a static build of
 * the viewer, opened with `colorScheme: null`: the sidebar entry and its
 * systems, `foundations.json` fetched once and only when the view opens, the
 * sections and their counts, resolved values, the dark variant by class, media
 * query and theme modes, fonts, the inspector, the frame's height, the viewer
 * theme and narrow widths. On react-browser it checks the link, and a copy of
 * its output without foundations must show no entry and fetch nothing. Then
 * check-presets.mjs checks the design-system blocks, contrast, the token
 * filter and the setup hint on every output and on the synthetic copies.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rootCustomProperties } from '../../packages/vitest/dist/root-custom-properties.js'
import { launchChromium } from '../docs/launch-chromium.mjs'
import { checkPresets } from './check-presets.mjs'
import {
  gotoViewer,
  hashParams,
  openViewer,
  sectionButtons,
  setHash,
  waitForFonts,
  waitForFrame,
} from './view-page.mjs'
import { serveViewers, WITHOUT_FOUNDATIONS } from './viewers.mjs'

// A copy of FOUNDATION_SECTIONS in packages/viewer/src/foundation-sections.ts.
const SECTIONS = [
  ['colors', 'Colors'],
  ['typography', 'Typography'],
  ['spacing', 'Spacing'],
  ['radius', 'Radius'],
  ['shadows', 'Shadows'],
  ['breakpoints', 'Breakpoints'],
  ['motion', 'Motion'],
  ['other', 'Other'],
]

const STYLE_REFERENCE = /^describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)$/
const PLAIN_REFERENCE = /^var\((--[\w-]+)\)$/

const SYSTEMS = {
  'react-browser': 'custom properties',
  'react-jsdom': 'styled-components',
  shadcn: 'Tailwind · shadcn/ui',
  mui: 'Material UI · Emotion',
  'mui, MUI_CSS_VARS=1': 'Material UI · Emotion',
}

/** Every `--mui-*` gives way to the theme module, so both MUI outputs show the same. */
const MUI_SECTIONS = [
  ['Colors', 53],
  ['Typography', 18],
  ['Spacing', 13],
  ['Radius', 1],
  ['Shadows', 25],
  ['Breakpoints', 5],
  ['Motion', 11],
  ['Other', 8],
]

const FIXED_SECTIONS = {
  'react-browser': [['Colors', 7]],
  // 3 theme colors and 7 custom properties.
  'react-jsdom': [['Colors', 10]],
  mui: MUI_SECTIONS,
  'mui, MUI_CSS_VARS=1': MUI_SECTIONS,
}

/** What shadcn's src/index.css adds to its Tailwind theme: 31 semantic colors, and `--radius`. */
const SHADCN_COLORS = 31
const SHADCN_RADIUS = 1

const INSPECTOR = {
  'react-browser': ['prefers-color-scheme'],
  shadcn: ['src/index.css', 'class .dark'],
  mui: ['src/theme.ts', 'theme modes'],
  'mui, MUI_CSS_VARS=1': ['prefers-color-scheme, theme modes', '3 token sheets, 3 font sheets'],
}

const RESOLVED = {
  shadcn: { section: 'radius', token: '--radius-lg', contains: ['var(--radius)', '0.625rem'] },
  'mui, MUI_CSS_VARS=1': {
    section: 'spacing',
    token: 'spacing(1)',
    contains: ['var(--mui-spacing, 8px)', '8px'],
  },
  mui: { section: 'spacing', token: 'spacing(1)', exactly: '8px' },
}

const FONTS = {
  shadcn: 'Inter Variable',
  mui: 'Roboto',
}

/** How each output's dark variant shows, read from the root and one swatch, under `bg=light` then `bg=dark`. */
const DARK_CASES = {
  shadcn: {
    how: 'by class',
    property: '--primary',
    values: ['oklch(0.52 0.23 285)', 'oklch(0.7 0.18 285)'],
    rootClass: [false, true],
    swatchMatchesProbe: '--primary',
  },
  'react-browser': {
    how: 'by media',
    property: '--ink',
    values: ['#111', '#ededed'],
    scheme: true,
    bareRoot: true,
  },
  'mui, MUI_CSS_VARS=1': {
    how: 'by media',
    property: '--mui-palette-primary-main',
    values: ['#5b4bdb', '#a99cff'],
    swatch: 'palette.primary.main',
    swatchValues: ['rgb(91, 75, 219)', 'rgb(169, 156, 255)'],
  },
  mui: {
    how: 'by theme modes',
    swatch: 'palette.primary.main',
    swatchValues: ['rgb(91, 75, 219)', 'rgb(169, 156, 255)'],
    bareRoot: true,
  },
  'react-jsdom': {
    how: 'by theme modes',
    property: '--ink',
    values: ['#111', '#ededed'],
    swatch: 'colors.ink',
    swatchValues: ['rgb(17, 17, 17)', 'rgb(237, 237, 237)'],
  },
}

function sheetCss(outDir, cssText) {
  const reference = STYLE_REFERENCE.exec(cssText)

  if (reference === null) {
    return cssText
  }

  return reference[1]
    .split('+')
    .map((hash) => readFileSync(join(outDir, 'styles', `${hash}.css`), 'utf8'))
    .join('')
}

/**
 * shadcn's sections from its own foundations.json, so a Tailwind update in the
 * lockfile moves the expectation with it. Only what src/index.css adds is pinned.
 */
function shadcnSections({ outDir, foundations }) {
  const tailwind = foundations.tokens.filter((token) => token.source === 'tailwind')
  const tailwindNames = new Set(tailwind.map((token) => token.name))
  const declared = new Set(
    foundations.tokenSheets.flatMap((sheet) =>
      rootCustomProperties(sheetCss(outDir, sheet.cssText)),
    ),
  )

  const isAlias = (token) => {
    const target = PLAIN_REFERENCE.exec(token.value)?.[1]

    return target !== undefined && declared.has(target) && !tailwindNames.has(target)
  }

  const counts = new Map(SECTIONS.map(([id]) => [id, 0]))

  for (const token of tailwind) {
    if (!(token.group === 'colors' && isAlias(token))) {
      counts.set(token.group, counts.get(token.group) + 1)
    }
  }

  counts.set('colors', counts.get('colors') + SHADCN_COLORS)
  counts.set('radius', counts.get('radius') + SHADCN_RADIUS)

  return SECTIONS.filter(([id]) => counts.get(id) > 0).map(([id, title]) => [title, counts.get(id)])
}

function expectedSections(label, output) {
  return label === 'shadcn' ? shadcnSections(output) : FIXED_SECTIONS[label]
}

function idOf(title) {
  return SECTIONS.find(([, candidate]) => candidate === title)?.[0]
}

function same(actual, expected) {
  return {
    passed: JSON.stringify(actual) === JSON.stringify(expected),
    detail: `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  }
}

function tokenCount(page) {
  return page.evaluate(
    () => globalThis.specimenFrame().contentDocument.querySelectorAll('[data-token]').length,
  )
}

async function openSection(page, id, scheme = 'light') {
  await page.locator(`.foundations .foundations-sections button[data-section="${id}"]`).click()
  await waitForFrame(page, id, scheme)
}

/** The root's class, attributes and the computed custom property, the iframe's scheme and one swatch. */
function darkReading(page, { property, swatch, swatchMatchesProbe }) {
  return page.evaluate(
    ([name, token, probeProperty]) => {
      const iframe = globalThis.specimenFrame()
      const doc = iframe.contentDocument
      const root = doc.documentElement
      const view = doc.defaultView
      const chip = token
        ? doc.querySelector(`[data-token="${token}"] [data-specimen]`)
        : doc.querySelector(`[data-token="${probeProperty}"] [data-specimen]`)

      let probeColor = null

      if (probeProperty) {
        const probe = doc.createElement('div')
        probe.style.setProperty('background-color', `var(${probeProperty})`)
        doc.body.append(probe)
        probeColor = view.getComputedStyle(probe).backgroundColor
        probe.remove()
      }

      return {
        className: root.className,
        attributes: Array.from(root.attributes, (attribute) => attribute.name),
        value: name ? view.getComputedStyle(root).getPropertyValue(name).trim() : null,
        scheme: getComputedStyle(iframe).colorScheme,
        swatch: chip ? view.getComputedStyle(chip).backgroundColor : null,
        probeColor,
      }
    },
    [property ?? null, swatch ?? null, swatchMatchesProbe ?? null],
  )
}

function darkProblems(reading, expected, i) {
  const problems = []
  const bg = i === 0 ? 'light' : 'dark'

  if (expected.values && reading.value !== expected.values[i]) {
    problems.push(
      `${expected.property} is ${reading.value} under bg=${bg}, expected ${expected.values[i]}`,
    )
  }

  if (expected.swatchValues && reading.swatch !== expected.swatchValues[i]) {
    problems.push(
      `${expected.swatch} paints ${reading.swatch} under bg=${bg}, expected ${expected.swatchValues[i]}`,
    )
  }

  if (expected.rootClass) {
    const has = reading.className.split(' ').includes('dark')

    if (has !== expected.rootClass[i]) {
      problems.push(`the root ${has ? 'has' : 'lacks'} the class dark under bg=${bg}`)
    }
  }

  if (
    expected.swatchMatchesProbe &&
    (reading.swatch === null || reading.swatch !== reading.probeColor)
  ) {
    problems.push(
      `the ${expected.swatchMatchesProbe} swatch paints ${reading.swatch}, a probe ${reading.probeColor}`,
    )
  }

  if (expected.scheme && reading.scheme !== bg) {
    problems.push(`the iframe's color-scheme is ${reading.scheme} under bg=${bg}`)
  }

  if (expected.bareRoot && (reading.className !== '' || reading.attributes.length > 0)) {
    problems.push(
      `the root has class "${reading.className}" and attributes ${reading.attributes.join(', ')}`,
    )
  }

  return problems
}

async function checkDark(check, label, page) {
  const expected = DARK_CASES[label]
  const readings = []

  await check(`${label}: bg=light then bg=dark show the dark variant ${expected.how}`, async () => {
    for (const bg of ['light', 'dark']) {
      await setHash(page, `foundations=colors&bg=${bg}`)
      await waitForFrame(page, 'colors', bg)
      readings.push(await darkReading(page, expected))
    }

    const problems = readings.flatMap((reading, i) => darkProblems(reading, expected, i))

    return { passed: problems.length === 0, detail: problems.join('; ') }
  })

  await check(
    `${label}: bg=transparent puts a light iframe on the transparent canvas`,
    async () => {
      await setHash(page, 'foundations=colors&bg=transparent')
      await waitForFrame(page, 'colors', 'light')

      const shown = await page.evaluate(() => ({
        canvas: document.querySelector('.foundations .foundations-canvas').dataset.canvas,
        scheme: getComputedStyle(globalThis.specimenFrame()).colorScheme,
      }))

      return same(shown, { canvas: 'transparent', scheme: 'light' })
    },
  )
}

async function checkSwatchClick(check, label, page) {
  await check(
    `${label}: the view's dark swatch writes bg=dark without a history entry and keeps the focus`,
    async () => {
      await setHash(page, 'foundations=colors&bg=light')
      await waitForFrame(page, 'colors', 'light')

      const before = await page.evaluate(() => history.length)
      const swatch = page.locator('.foundations .backgrounds [data-bg="dark"]')
      await swatch.click()
      await waitForFrame(page, 'colors', 'dark')

      const after = await page.evaluate(() => ({
        length: history.length,
        bg: new URLSearchParams(location.hash.slice(1)).get('bg'),
        focused:
          document.activeElement?.matches('.foundations .backgrounds [data-bg="dark"]') ?? false,
      }))

      return same(after, { length: before, bg: 'dark', focused: true })
    },
  )
}

async function checkResolved(check, label, page) {
  const expected = RESOLVED[label]

  await check(
    `${label}: ${expected.token} in ${expected.section} shows ${expected.exactly ?? expected.contains.join(' and ')}`,
    async () => {
      await openSection(page, expected.section)

      const text = await page.evaluate(
        (token) =>
          globalThis
            .specimenFrame()
            .contentDocument.querySelector(`[data-token="${token}"] [data-value]`)?.textContent ??
          null,
        expected.token,
      )

      const passed = expected.exactly
        ? text === expected.exactly
        : text !== null && expected.contains.every((part) => text.includes(part))

      return { passed, detail: JSON.stringify(text) }
    },
  )
}

async function checkFonts(check, label, page) {
  const family = FONTS[label]

  await check(`${label}: Typography loads the ${family} face in the specimen frame`, async () => {
    await openSection(page, 'typography')
    await waitForFonts(page)

    const faces = await page.evaluate(() =>
      Array.from(globalThis.specimenFrame().contentDocument.fonts, (face) => [
        face.family.replace(/^["']|["']$/g, ''),
        face.status,
      ]),
    )

    const loaded = faces.some(([name, status]) => name === family && status === 'loaded')

    return { passed: loaded, detail: JSON.stringify(faces.slice(0, 6)) }
  })
}

async function checkHeight(check, label, page, section) {
  await check(
    `${label}: once fonts settle, the ${section} frame fits its content and does not scroll`,
    async () => {
      await waitForFonts(page)

      const box = await page.evaluate(() => {
        const iframe = globalThis.specimenFrame()
        const doc = iframe.contentDocument

        return {
          frame: iframe.getBoundingClientRect().height,
          content: doc.querySelector('.fd-root').getBoundingClientRect().bottom,
          scrollHeight: doc.documentElement.scrollHeight,
          clientHeight: doc.documentElement.clientHeight,
        }
      })

      const fits = Math.abs(box.frame - box.content) <= 2
      const still = box.scrollHeight <= box.clientHeight

      return { passed: fits && still, detail: JSON.stringify(box) }
    },
  )
}

/** The entry, laziness, sections and counts, then the cases that need the open view. */
async function checkMain(check, label, url, output, browser) {
  const viewer = await openViewer(browser, url)
  const { page } = viewer
  const expected = expectedSections(label, output)

  try {
    await gotoViewer(viewer, url)

    await check(
      `${label}: the sidebar entry reads Foundations, ${SYSTEMS[label]}, and nothing fetched foundations.json`,
      async () => {
        const entry = await page.evaluate(() => ({
          title:
            document.querySelector('.foundations-entry .foundations-title')?.textContent ?? null,
          systems:
            document.querySelector('.foundations-entry .foundations-systems')?.textContent ?? null,
        }))

        return same(
          { ...entry, requests: viewer.foundationsRequests() },
          {
            title: 'Foundations',
            systems: SYSTEMS[label],
            requests: 0,
          },
        )
      },
    )

    await check(
      `${label}: the entry opens foundations=colors with one request for foundations.json`,
      async () => {
        await page.locator('.foundations-entry').click()
        await waitForFrame(page, 'colors')

        const params = await hashParams(page)

        return same(
          { foundations: params.foundations, requests: viewer.foundationsRequests() },
          {
            foundations: 'colors',
            requests: 1,
          },
        )
      },
    )

    await check(
      `${label}: the sections read ${expected.map(([title, count]) => `${title} ${count}`).join(', ')}`,
      async () => same(await sectionButtons(page), expected),
    )

    await check(`${label}: Colors has as many [data-token] as its count`, async () =>
      same(await tokenCount(page), expected[0][1]),
    )

    await checkHeight(check, label, page, 'colors')

    const smallest = expected.reduce((best, entry) => (entry[1] < best[1] ? entry : best))

    await check(
      `${label}: ${smallest[0]}, the smallest section, has as many [data-token] as its count`,
      async () => {
        await openSection(page, idOf(smallest[0]))

        return same(await tokenCount(page), smallest[1])
      },
    )

    if (RESOLVED[label]) {
      await checkResolved(check, label, page)
    }

    if (FONTS[label]) {
      await checkFonts(check, label, page)
      await checkHeight(check, label, page, 'typography')
    }

    await check(`${label}: switching sections fetched foundations.json no more`, () =>
      same(viewer.foundationsRequests(), 1),
    )

    if (INSPECTOR[label]) {
      await check(`${label}: the inspector names ${INSPECTOR[label].join(' and ')}`, async () => {
        const text = await page.locator('.inspector').innerText()
        const missing = INSPECTOR[label].filter((part) => !text.includes(part))

        return {
          passed: missing.length === 0,
          detail: `missing ${missing.join(', ')} in ${JSON.stringify(text)}`,
        }
      })
    }

    await checkDark(check, label, page)

    if (label === 'shadcn') {
      await checkSwatchClick(check, label, page)
    }
  } finally {
    await viewer.close()
  }

  return viewer.failures
}

/** The specimens must not follow the viewer theme, and the panel's chrome must. */
async function checkViewerTheme(check, label, url, browser) {
  const runs = {}
  const failures = []

  for (const theme of ['light', 'dark']) {
    const viewer = await openViewer(browser, url, { theme })

    try {
      await gotoViewer(viewer, url, '#foundations=colors')
      await waitForFrame(viewer.page, 'colors')
      runs[theme] = await viewer.page.evaluate(() => {
        const doc = globalThis.specimenFrame().contentDocument
        const view = doc.defaultView

        return {
          color: view.getComputedStyle(doc.documentElement).color,
          swatches: Array.from(
            doc.querySelectorAll('[data-specimen]'),
            (chip) => view.getComputedStyle(chip).backgroundColor,
          ).slice(0, 12),
          panel: getComputedStyle(document.querySelector('.foundations')).backgroundColor,
        }
      })
    } finally {
      await viewer.close()
    }

    failures.push(...viewer.failures)
  }

  await check(`${label}: the viewer theme changes the panel's background and no specimen`, () => {
    const { light, dark } = runs
    const passed =
      light !== undefined &&
      dark !== undefined &&
      light.color === dark.color &&
      JSON.stringify(light.swatches) === JSON.stringify(dark.swatches) &&
      light.panel !== dark.panel

    return { passed, detail: JSON.stringify(runs) }
  })

  return failures
}

async function checkNarrow(check, label, url, browser) {
  const failures = []
  const medium = await openViewer(browser, url, { width: 960 })

  try {
    await check(
      `${label}: at 960 px the center is 344 px wide and neither the panel nor the frame overflows`,
      async () => {
        await gotoViewer(medium, url, '#foundations=colors')
        await waitForFrame(medium.page, 'colors')
        await waitForFonts(medium.page)

        const box = await medium.page.evaluate(() => {
          const panel = document.querySelector('.foundations')
          const doc = globalThis.specimenFrame().contentDocument

          return {
            center: document.querySelector('.center').getBoundingClientRect().width,
            panel: panel.scrollWidth - panel.clientWidth,
            frame: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
          }
        })

        return same(box, { center: 344, panel: 0, frame: 0 })
      },
    )
  } finally {
    await medium.close()
  }

  const narrow = await openViewer(browser, url, { width: 390 })

  try {
    await check(`${label}: at 390 px the document is as wide as with a test view`, async () => {
      await gotoViewer(narrow, url)
      const testView = await narrow.page.evaluate(() => document.documentElement.scrollWidth)
      await narrow.page.locator('.foundations-entry').click()
      await waitForFrame(narrow.page, 'colors')
      const foundations = await narrow.page.evaluate(() => document.documentElement.scrollWidth)

      return same(foundations, testView)
    })
  } finally {
    await narrow.close()
  }

  failures.push(...medium.failures, ...narrow.failures)

  return failures
}

/** Each link loads in a page of its own, so the correction is the first paint's. */
async function checkCorrection(check, url, browser, hash) {
  const viewer = await openViewer(browser, url)

  try {
    await check(`react-browser: ${hash} ends at foundations=colors`, async () => {
      await gotoViewer(viewer, url, hash)
      await waitForFrame(viewer.page, 'colors')
      await viewer.page.waitForFunction(() => location.hash.includes('foundations=colors'))

      return same((await hashParams(viewer.page)).foundations, 'colors')
    })
  } finally {
    await viewer.close()
  }

  return viewer.failures
}

/**
 * The link changes while `manifest.json` is held back. Before a manifest is
 * in, the test view and Foundations must agree on which one is shown, or the
 * repaint calls itself until the stack overflows. Nothing may fetch
 * `foundations.json` before the manifest says there are tokens.
 */
async function checkBeforeManifest(check, url, browser) {
  const viewer = await openViewer(browser, url)
  const { page } = viewer
  let release = () => {}
  const held = new Promise((resolve) => {
    release = resolve
  })

  await page.route('**/__data/manifest.json', async (route) => {
    await held
    await route.continue()
  })

  try {
    await check(
      'react-browser: link changes before the manifest arrives repaint without a loop, and Foundations opens once it is in',
      async () => {
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await setHash(page, 'foundations=colors')
        await setHash(page, 'test=abc')
        await page.goBack()
        await page.waitForFunction(() => location.hash === '#foundations=colors')

        const early = viewer.foundationsRequests()
        release()
        await waitForFrame(page, 'colors')

        const errors = viewer.failures.filter((failure) => failure.startsWith('page error'))

        return same({ early, errors }, { early: 0, errors: [] })
      },
    )
  } finally {
    release()
    await viewer.close()
  }

  return viewer.failures
}

/**
 * Unknown and empty sections, link changes before the manifest, Back after a
 * test click, and the shortcuts that must do nothing.
 */
async function checkLink(check, url, browser) {
  const failures = [
    ...(await checkCorrection(check, url, browser, '#foundations=bogus')),
    ...(await checkCorrection(check, url, browser, '#foundations=motion')),
    ...(await checkBeforeManifest(check, url, browser)),
  ]

  const viewer = await openViewer(browser, url)
  const { page } = viewer

  try {
    await gotoViewer(viewer, url, '#foundations=colors')
    await waitForFrame(page, 'colors')

    await check(
      'react-browser: a test click removes foundations from the link, and Back brings it back',
      async () => {
        await page.locator('.tree .test').nth(1).click()
        await page.waitForFunction(() => !location.hash.includes('foundations='))
        const leaving = await hashParams(page)
        await page.goBack()
        await waitForFrame(page, 'colors')
        const back = await hashParams(page)

        return same(
          [leaving.foundations ?? null, Boolean(leaving.test), back.foundations],
          [null, true, 'colors'],
        )
      },
    )

    await check(
      'react-browser: ← → ↑ ↓ and L leave the link unchanged while Foundations is open',
      async () => {
        await page.locator('.foundations h1').click()
        const before = await page.evaluate(() => [location.hash, history.length])

        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'l', 'L']) {
          await page.keyboard.press(key)
        }

        const after = await page.evaluate(() => [location.hash, history.length])

        return same(after, before)
      },
    )
  } finally {
    await viewer.close()
  }

  return [...failures, ...viewer.failures]
}

async function checkWithout(check, url, browser) {
  const plain = await openViewer(browser, url)
  const linked = await openViewer(browser, url)

  try {
    await check(
      `${WITHOUT_FOUNDATIONS}: no entry, #foundations=colors shows the first test and drops the parameter, nothing fetched foundations.json`,
      async () => {
        await gotoViewer(plain, url)
        const entry = await plain.page.locator('.foundations-entry').isVisible()

        await gotoViewer(linked, url, '#foundations=colors')
        await linked.page.waitForFunction(() => !location.hash.includes('foundations='))

        const shown = await linked.page.evaluate(() => ({
          panel: document.querySelector('.foundations') !== null,
          firstActive: document.querySelector('.tree .test')?.classList.contains('active') ?? false,
          foundations: new URLSearchParams(location.hash.slice(1)).get('foundations'),
        }))

        const requests = plain.foundationsRequests() + linked.foundationsRequests()

        return same(
          { entry, ...shown, requests },
          {
            entry: false,
            panel: false,
            firstActive: true,
            foundations: null,
            requests: 0,
          },
        )
      },
    )
  } finally {
    await plain.close()
    await linked.close()
  }

  return [...plain.failures, ...linked.failures]
}

async function checkOutput(check, label, url, output, browser) {
  const failures = [
    ...(await checkMain(check, label, url, output, browser)),
    ...(await checkViewerTheme(check, label, url, browser)),
    ...(await checkNarrow(check, label, url, browser)),
  ]

  await check(`${label}: no page error, console error or failed request in the view`, () => ({
    passed: failures.length === 0,
    detail: [...new Set(failures)].join('; '),
  }))
}

/**
 * Run the Chromium cases on `outputs`, as check-foundations reads them, with
 * its `check()` and `tempDir()`.
 */
export async function checkView({ check, tempDir, outputs }) {
  let served

  try {
    served = await serveViewers(outputs, tempDir)
  } catch (error) {
    await check('Foundations view: every output builds with describe-me build', () => ({
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    }))

    return
  }

  const browser = await launchChromium()

  try {
    for (const [label, output] of Object.entries(outputs)) {
      await checkOutput(check, label, served.urls[label], output, browser)
    }

    if (served.urls['react-browser']) {
      const failures = [
        ...(await checkLink(check, served.urls['react-browser'], browser)),
        ...(await checkWithout(check, served.urls[WITHOUT_FOUNDATIONS], browser)),
      ]

      await check(
        'react-browser: no page error, console error or failed request around the link',
        () => ({
          passed: failures.length === 0,
          detail: [...new Set(failures)].join('; '),
        }),
      )
    }

    await checkPresets({ check, browser, urls: served.urls, outputs })
  } finally {
    await browser.close()
    served.server.close()
  }
}
