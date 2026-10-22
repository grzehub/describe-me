/**
 * The preset cases of check-foundations, in Chromium on the static builds
 * that check-view.mjs serves: the blocks of each design system with their
 * ids, readable titles, prefixes and counts, the `default` badge of Tailwind
 * and of Material UI per section and per background, pair tiles with their
 * WCAG contrast, the spacing scales, drop and text shadows, the token filter
 * and `/`, the Material UI setup hint, the type styles composed from custom
 * properties, and the synthetic copies of copies.mjs. The MUI output without
 * its theme module has no specimen frame, so check-view.mjs covers it. Every
 * page opens through `openViewer()`.
 */
import {
  CHAKRA_COPY,
  COPIES,
  MUI_DEFAULT_DARK_PRIMARY,
  MUI_VARIABLES_ONLY,
  MUI_WITHOUT_THEME,
  TYPE_STYLES_COPY,
} from './copies.mjs'
import {
  gotoViewer,
  openViewer,
  sectionButtons,
  setHash,
  waitForFonts,
  waitForFrame,
} from './view-page.mjs'
import { HINT_ONLY } from './viewers.mjs'

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

const CONTRAST_TOLERANCE = 0.15
const CONTRAST_TEXT = /^(\d+\.\d):1 (AAA|AA large|AA|fail)$/
const PIXEL_TOLERANCE = 0.5
const UPDATE_TIMEOUT = 5_000
const BACKGROUNDS = ['light', 'dark']

/** A copy of the setup hint in packages/viewer/src/foundations-view.ts. */
export const SETUP_SENTENCE =
  "To show the Material UI theme here, name its module in foundations: { theme: 'src/theme.ts' }, which also marks Material UI's defaults, or create the theme with cssVariables: true."

/** Ratio and level under `bg=light`, then `bg=dark`. `null` where no pin applies. */
const SHADCN_CONTRAST = {
  '--primary': [
    [5.85, 'AA'],
    [6.28, 'AA'],
  ],
  '--muted': [
    [4.35, 'AA large'],
    [5.86, 'AA'],
  ],
  '--background': [
    [19.8, 'AAA'],
    [18.97, 'AAA'],
  ],
}

const MUI_CONTRAST = {
  primary: [
    [6.05, 'AA'],
    [7.69, 'AAA'],
  ],
  secondary: [[4.32, 'AA large'], null],
}

const INTENTS = ['primary', 'secondary', 'error', 'warning', 'info', 'success']
const VARIANTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'subtitle1',
  'subtitle2',
  'body1',
  'body2',
  'button',
  'caption',
  'overline',
]

const VARIANT_SIZES = [
  '40px',
  '60px',
  '48px',
  '34px',
  '24px',
  '20px',
  '16px',
  '14px',
  '16px',
  '14px',
  '14px',
  '12px',
  '12px',
]

/** Measured on the `--mui-*` only copy: the 232 custom properties without the 33 `…Channel`. */
const MUI_VARIABLE_SECTIONS = [
  ['Colors', 115],
  ['Typography', 14],
  ['Spacing', 1],
  ['Radius', 1],
  ['Shadows', 26],
  ['Other', 42],
]

/** The `[data-origin="default"]` of each section in both MUI outputs, the same under `bg=light` and `bg=dark`. */
const MUI_DEFAULTS = [
  ['Colors', 47],
  ['Typography', 16],
  ['Spacing', 13],
  ['Radius', 0],
  ['Shadows', 25],
  ['Breakpoints', 5],
  ['Motion', 11],
  ['Other', 8],
]

/** How many badges each token shows itself, not counting a foreground nested in its tile. */
const MUI_BADGES = {
  'palette.primary.main': 0,
  'typography.h1': 0,
  'shape.borderRadius': 0,
  'palette.error.main': 1,
  'typography.h2': 1,
}

const CHAKRA_SECTIONS = [
  ['Colors', 7],
  ['Typography', 4],
  ['Spacing', 3],
  ['Radius', 2],
  ['Shadows', 2],
  ['Motion', 2],
]

const CHAKRA_TITLES = [
  ['spacing', 'Chakra spacing'],
  ['radius', 'Chakra radii'],
  ['shadows', 'Chakra shadows'],
  ['motion', 'Chakra durations'],
]

const TYPE_STYLES_BLOCKS = [
  ['prefix-font', 'Font', '--font-*', 2],
  ['prefix-type', 'Type', '--type-*', 3],
  ['prefix-font-size', 'Font size', '--font-size-*', 2],
  ['prefix-line-height', 'Line height', '--line-height-*', 2],
  ['prefix-letter-spacing', 'Letter spacing', '--letter-spacing-*', 2],
  ['custom-properties', 'Custom properties', null, 3],
]

/** The computed style of each token's sample in the copy, at the frame's 20px sample size and 15px paragraph size. */
const TYPE_STYLES_SAMPLES = {
  '--type-display-*': {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: '48px',
    fontWeight: '700',
    lineHeight: '52.8px',
    letterSpacing: '-0.96px',
  },
  '--type-title-*': { fontSize: '32px', fontWeight: '600', lineHeight: '40px' },
  '--type-body-*': { fontSize: '16px', lineHeight: '24px' },
  '--heading-*': { fontSize: '24px', lineHeight: '32px' },
  '--font-size-lg': { fontSize: '18px' },
  '--line-height-tight': { lineHeight: '18.75px' },
  '--letter-spacing-wide': { letterSpacing: '1px' },
  '--link-font-weight': { fontWeight: '500' },
}

function same(actual, expected) {
  return {
    passed: JSON.stringify(actual) === JSON.stringify(expected),
    detail: `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  }
}

function outcome(problems) {
  return { passed: problems.length === 0, detail: problems.join('; ') }
}

function idOf(title) {
  return SECTIONS.find(([, candidate]) => candidate === title)?.[0]
}

/** Show `section` under `bg` through the link, and wait for its frame. */
async function showSection(page, section, bg = 'light') {
  await setHash(page, `foundations=${section}&bg=${bg}`)
  await waitForFrame(page, section, bg)
}

/** Each block of the frame, its title read without its prefix, count and badge. */
function readBlocks(page) {
  return page.evaluate(() =>
    Array.from(
      globalThis.specimenFrame().contentDocument.querySelectorAll('.fd-block'),
      (block) => {
        const heading = block.querySelector('.fd-block-title')
        const title = heading.cloneNode(true)
        title.querySelectorAll('.fd-prefix, .fd-count, .fd-badge').forEach((part) => part.remove())

        return {
          id: block.dataset.block,
          title: title.textContent.trim(),
          prefix: heading.querySelector('.fd-prefix')?.textContent ?? null,
          tokens: block.querySelectorAll('[data-token]').length,
          pairs: block.querySelectorAll('[data-pair]').length,
          badge: heading.querySelector('.fd-badge')?.textContent ?? null,
          note: block.querySelector('.fd-note')?.textContent ?? null,
          names: Array.from(block.querySelectorAll('[data-token]'), (token) => token.dataset.token),
        }
      },
    ),
  )
}

function count(page, selector) {
  return page.evaluate(
    (target) => globalThis.specimenFrame().contentDocument.querySelectorAll(target).length,
    selector,
  )
}

function tokenCount(page) {
  return count(page, '[data-token]')
}

/** The names of the tokens the filter leaves shown. */
function shownTokens(page) {
  return page.evaluate(() =>
    Array.from(
      globalThis.specimenFrame().contentDocument.querySelectorAll('[data-token]:not([hidden])'),
      (token) => token.dataset.token,
    ),
  )
}

function readContrast(page, token) {
  return page.evaluate((name) => {
    const doc = globalThis.specimenFrame().contentDocument
    const tile = Array.from(doc.querySelectorAll('[data-pair]')).find(
      (candidate) => candidate.dataset.token === name,
    )

    if (!tile) {
      return null
    }

    return {
      ratio: Number(tile.dataset.contrast),
      level: tile.dataset.level ?? null,
      text: tile.querySelector('.fd-contrast')?.textContent ?? null,
    }
  }, token)
}

function swatchColor(page, token) {
  return page.evaluate((name) => {
    const doc = globalThis.specimenFrame().contentDocument
    const element = Array.from(doc.querySelectorAll('[data-token]')).find(
      (candidate) => candidate.dataset.token === name,
    )

    const chip = element?.querySelector('[data-specimen]')

    return chip ? doc.defaultView.getComputedStyle(chip).backgroundColor : null
  }, token)
}

/** The `[data-step]` rows and the bar and value of one step. */
function readScale(page, step) {
  return page.evaluate((wanted) => {
    const doc = globalThis.specimenFrame().contentDocument
    const row = Array.from(doc.querySelectorAll('[data-step]')).find(
      (candidate) => candidate.dataset.step === String(wanted),
    )

    return {
      steps: doc.querySelectorAll('[data-step]').length,
      width: row?.querySelector('.fd-bar')?.getBoundingClientRect().width ?? null,
      value: row?.querySelector('.fd-value')?.textContent ?? null,
    }
  }, step)
}

function hasToken(page, name) {
  return page.evaluate(
    (wanted) =>
      Array.from(globalThis.specimenFrame().contentDocument.querySelectorAll('[data-token]')).some(
        (token) => token.dataset.token === wanted,
      ),
    name,
  )
}

function contrastProblems(token, reading, [ratio, level], bg) {
  if (!reading) {
    return [`${token} has no pair tile under bg=${bg}`]
  }

  const problems = []
  const [, shown = '', shownLevel = ''] = CONTRAST_TEXT.exec(reading.text ?? '') ?? []
  // The text floors the unrounded ratio, so it may sit up to 0.1 under `data-contrast`.
  const floored = Number(shown) <= reading.ratio + 0.005 && reading.ratio - Number(shown) < 0.105

  if (Math.abs(reading.ratio - ratio) > CONTRAST_TOLERANCE || reading.level !== level) {
    problems.push(
      `${token} is ${reading.ratio} ${reading.level} under bg=${bg}, expected ${ratio} ${level}`,
    )
  }

  if (!floored || shownLevel !== reading.level) {
    problems.push(`${token} reads ${JSON.stringify(reading.text)} under bg=${bg}`)
  }

  return problems
}

/** Each pin under `bg=light`, then `bg=dark`. */
async function checkContrast(check, label, page, pins) {
  const names = Object.keys(pins).join(', ')

  await check(
    `${label}: the pair tiles of ${names} show their WCAG contrast for each bg`,
    async () => {
      const problems = []

      for (const [i, bg] of BACKGROUNDS.entries()) {
        await showSection(page, 'colors', bg)

        for (const [token, expected] of Object.entries(pins)) {
          if (expected[i]) {
            problems.push(
              ...contrastProblems(token, await readContrast(page, token), expected[i], bg),
            )
          }
        }
      }

      return outcome(problems)
    },
  )
}

/** Case 1, on every output and copy. */
async function checkCounts(check, label, page) {
  await check(
    `${label}: every section's count equals its [data-token] count, and no block title holds --, . or mui-`,
    async () => {
      const problems = []

      for (const [title, count] of await sectionButtons(page)) {
        await showSection(page, idOf(title))

        const tokens = await tokenCount(page)
        const blocks = await readBlocks(page)

        if (tokens !== count) {
          problems.push(`${title} counts ${count} and shows ${tokens}`)
        }

        for (const block of blocks) {
          if (['--', '.', 'mui-'].some((part) => block.title.includes(part))) {
            problems.push(`${block.id} is titled ${JSON.stringify(block.title)}`)
          }
        }
      }

      return outcome(problems)
    },
  )
}

function blockSummary(blocks) {
  return blocks.map((block) => [block.id, block.tokens])
}

async function checkShadcnColors(check, page, foundations) {
  const palette = foundations.tokens.filter(
    (token) =>
      token.source === 'tailwind' && token.group === 'colors' && token.origin === 'default',
  ).length

  const expected = [
    ['shadcn-semantic', 18],
    ['shadcn-chart', 5],
    ['shadcn-sidebar', 8],
    ['tailwind-ramp-brand', 11],
    ['tailwind-palette', palette],
  ]

  await check(
    `shadcn: Colors shows ${expected.map(([id, count]) => `${id} ${count}`).join(', ')} and 10 pair tiles`,
    async () => {
      await showSection(page, 'colors')

      const blocks = await readBlocks(page)
      const pairs = blocks.reduce((sum, block) => sum + block.pairs, 0)

      return same({ blocks: blockSummary(blocks), pairs }, { blocks: expected, pairs: 10 })
    },
  )

  await check(
    'shadcn: the palette has no names, chips of at most 28 px with a title, the removal note and the default badge',
    async () => {
      const blocks = await readBlocks(page)
      const block = blocks.find((candidate) => candidate.id === 'tailwind-palette')
      const chips = await page.evaluate(() => {
        const palette = globalThis
          .specimenFrame()
          .contentDocument.querySelector('[data-block="tailwind-palette"]')

        const tokens = Array.from(palette.querySelectorAll('[data-token]'))

        return {
          names: palette.querySelectorAll('.fd-name').length,
          wide: tokens.filter((chip) => chip.getBoundingClientRect().width > 28).length,
          untitled: tokens.filter((chip) => !chip.title).length,
        }
      })

      const problems = [
        chips.names > 0 ? `${chips.names} .fd-name` : null,
        chips.wide > 0 ? `${chips.wide} chips wider than 28 px` : null,
        chips.untitled > 0 ? `${chips.untitled} chips without a title` : null,
        block?.note?.includes('--color-*: initial') ? null : `the note reads ${block?.note}`,
        block?.badge === 'default' ? null : `the title's badge reads ${block?.badge}`,
      ].filter(Boolean)

      return outcome(problems)
    },
  )
}

async function checkShadcnBadges(check, page, foundations) {
  const defaults = foundations.tokens.filter(
    (token) =>
      token.source === 'tailwind' && token.group === 'typography' && token.origin === 'default',
  ).length

  await check(
    `shadcn: Typography has ${defaults} [data-origin="default"], each with a default badge after its name, and --font-sans none`,
    async () => {
      await showSection(page, 'typography')

      const badges = await page.evaluate(() => {
        const doc = globalThis.specimenFrame().contentDocument
        const marked = Array.from(doc.querySelectorAll('[data-origin="default"]'))
        const sans = doc.querySelector('[data-token="--font-sans"]')
        const badged = marked.filter(
          (token) => token.querySelector('.fd-name + .fd-badge')?.textContent === 'default',
        )

        return {
          marked: marked.length,
          badged: badged.length,
          sans: sans
            ? [sans.dataset.origin ?? null, sans.querySelectorAll('.fd-badge').length]
            : null,
        }
      })

      return same(badges, { marked: defaults, badged: defaults, sans: [null, 0] })
    },
  )

  await check('shadcn: Radius shows shadcn-radius 5, then tailwind-radius 4', async () => {
    await showSection(page, 'radius')

    return same(blockSummary(await readBlocks(page)), [
      ['shadcn-radius', 5],
      ['tailwind-radius', 4],
    ])
  })
}

async function checkShadcnScale(check, page) {
  await check(
    'shadcn: Spacing shows --spacing and 18 [data-step] rows, step 4 a 16 px bar reading → 16px',
    async () => {
      await showSection(page, 'spacing')

      const scale = await readScale(page, 4)
      const base = await hasToken(page, '--spacing')
      const passed =
        base &&
        scale.steps === 18 &&
        Math.abs(scale.width - 16) <= PIXEL_TOLERANCE &&
        Boolean(scale.value?.endsWith('→ 16px'))

      return { passed, detail: JSON.stringify({ base, ...scale }) }
    },
  )

  await check(
    'shadcn: the first drop shadow paints filter: drop-shadow(…), the first text shadow a text-shadow',
    async () => {
      await showSection(page, 'shadows')

      const painted = await page.evaluate(() => {
        const doc = globalThis.specimenFrame().contentDocument
        const drop = doc.querySelector('[data-block="tailwind-drop-shadows"] [data-specimen]')
        const text = doc.querySelector('[data-block="tailwind-text-shadows"] [data-specimen]')

        return {
          filter: drop ? doc.defaultView.getComputedStyle(drop).filter : null,
          textShadow: text ? doc.defaultView.getComputedStyle(text).textShadow : null,
        }
      })

      const passed =
        Boolean(painted.filter?.startsWith('drop-shadow(')) &&
        painted.textShadow !== null &&
        painted.textShadow !== 'none'

      return { passed, detail: JSON.stringify(painted) }
    },
  )
}

function activeMatches(page, selector) {
  return page.evaluate((target) => document.activeElement?.matches(target) ?? false, selector)
}

/** Type into the filter and wait until the Colors button counts `count`. */
async function filterBy(page, query, count) {
  await page.locator('.foundations .foundations-filter').fill(query)
  await page.waitForFunction(
    (expected) =>
      document.querySelector('.foundations-sections button[data-section="colors"] .count')
        ?.textContent === expected,
    String(count),
    { timeout: UPDATE_TIMEOUT },
  )
}

async function checkSlash(check, page) {
  await check(
    'shadcn: / focuses the token filter in Foundations and the sidebar search in a test view',
    async () => {
      await showSection(page, 'colors')
      await page.locator('.foundations h1').click()
      await page.keyboard.press('/')
      const inFoundations = await activeMatches(page, '.foundations .foundations-filter')

      await page.locator('.tree .test').first().click()
      await page.waitForFunction(() => !location.hash.includes('foundations='))
      await page.keyboard.press('/')
      const inTestView = await activeMatches(page, '.sidebar-search')

      return same({ inFoundations, inTestView }, { inFoundations: true, inTestView: true })
    },
  )
}

async function checkFilter(check, page) {
  await checkSlash(check, page)
  await showSection(page, 'colors')

  const counts = await sectionButtons(page)
  const link = await page.evaluate(() => [location.hash, history.length])
  const brand = counts.map(([title]) => [title, title === 'Colors' ? 11 : 0])

  await check(
    'shadcn: brand leaves Colors 11, every --color-brand-*, and no other section',
    async () => {
      await filterBy(page, 'brand', 11)

      const shown = await shownTokens(page)
      const buttons = await sectionButtons(page)
      const passed =
        JSON.stringify(buttons) === JSON.stringify(brand) &&
        shown.length === 11 &&
        shown.every((name) => name.startsWith('--color-brand-'))

      return { passed, detail: JSON.stringify({ buttons, shown }) }
    },
  )

  await check(
    'shadcn: 0.7 0.18 285 leaves Colors 5, --color-brand-400 and the --primary and --sidebar-primary pairs',
    async () => {
      await filterBy(page, '0.7 0.18 285', 5)

      return same((await shownTokens(page)).sort(), [
        '--color-brand-400',
        '--primary',
        '--primary-foreground',
        '--sidebar-primary',
        '--sidebar-primary-foreground',
      ])
    },
  )

  await check('shadcn: typing in the filter leaves the link and the history unchanged', async () =>
    same(await page.evaluate(() => [location.hash, history.length]), link),
  )

  await check(
    'shadcn: Esc clears the filter, leaves the field and restores every count',
    async () => {
      await page.locator('.foundations .foundations-filter').press('Escape')
      await page.waitForFunction(
        (expected) =>
          document.querySelector('.foundations-sections button[data-section="colors"] .count')
            ?.textContent === expected,
        String(counts[0][1]),
        { timeout: UPDATE_TIMEOUT },
      )

      const after = {
        buttons: await sectionButtons(page),
        focused: await activeMatches(page, '.foundations .foundations-filter'),
        tokens: (await shownTokens(page)).length,
      }

      return same(after, { buttons: counts, focused: false, tokens: counts[0][1] })
    },
  )

  await check(
    'shadcn: Enter in a section without a match opens the first one with a match, without a history entry',
    async () => {
      await showSection(page, 'typography')

      const before = await page.evaluate(() => history.length)
      await page.locator('.foundations .foundations-filter').fill('brand')
      await page.locator('.foundations .foundations-filter').press('Enter')
      await waitForFrame(page, 'colors')

      const after = await page.evaluate(() => ({
        length: history.length,
        section: new URLSearchParams(location.hash.slice(1)).get('foundations'),
      }))

      await page.locator('.foundations .foundations-filter').fill('')
      await page.locator('.foundations .foundations-filter').press('Escape')

      return same(after, { length: before, section: 'colors' })
    },
  )
}

function sectionCount(page, section) {
  return page.evaluate(
    (id) =>
      Number(
        document.querySelector(`.foundations-sections button[data-section="${id}"] .count`)
          ?.textContent,
      ),
    section,
  )
}

async function waitForCount(page, section, expected) {
  await page.waitForFunction(
    ([id, wanted]) =>
      document.querySelector(`.foundations-sections button[data-section="${id}"] .count`)
        ?.textContent === wanted,
    [section, String(expected)],
    { timeout: UPDATE_TIMEOUT },
  )
}

/** Two frames, so the faces that shown samples need have started loading, then until they settle. */
async function settleFonts(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )

  await waitForFonts(page)
}

/**
 * A frame built while the filter hides every sample in a web font requests
 * that font only once the filter shows them again, so the content grows after
 * the filter has refit the frame. It needs a page of its own, because a face
 * that an earlier frame of the page loaded is ready at once.
 */
async function checkRevealedFit(check, label, page, [query, matches]) {
  await check(
    `${label}: with ${query} in the filter, Typography opened and Esc pressed, the frame fits its content once fonts settle`,
    async () => {
      const all = await sectionCount(page, 'typography')
      const field = page.locator('.foundations .foundations-filter')
      await field.fill(query)
      await waitForCount(page, 'typography', matches)
      await page
        .locator('.foundations .foundations-sections button[data-section="typography"]')
        .click()

      await waitForFrame(page, 'typography')
      // Past the frame's own wait for fonts, as when someone pauses before Esc.
      await settleFonts(page)
      await field.press('Escape')
      await waitForCount(page, 'typography', all)
      await settleFonts(page)

      const box = await page.evaluate(() => {
        const iframe = globalThis.specimenFrame()
        const root = iframe.contentDocument.querySelector('.fd-root')

        return {
          frame: iframe.getBoundingClientRect().height,
          content: Math.ceil(root.getBoundingClientRect().bottom),
        }
      })

      // fitFrame() sets the height to the rounded-up bottom edge, so a fit is exact.
      return {
        passed: Math.abs(box.frame - box.content) <= PIXEL_TOLERANCE,
        detail: JSON.stringify(box),
      }
    },
  )
}

async function checkShadcn(check, page, output) {
  await checkShadcnColors(check, page, output.foundations)
  await checkContrast(check, 'shadcn', page, SHADCN_CONTRAST)
  await checkShadcnBadges(check, page, output.foundations)
  await checkShadcnScale(check, page)
  await checkFilter(check, page)
}

/** Every block in every section, read once. */
async function everyBlock(page) {
  const blocks = {}

  for (const [title] of await sectionButtons(page)) {
    await showSection(page, idOf(title))
    blocks[idOf(title)] = await readBlocks(page)
  }

  return blocks
}

function findBlock(blocks, section, id) {
  return (blocks[section] ?? []).find((block) => block.id === id)
}

function setupShown(page) {
  return page.evaluate(() => document.querySelector('.foundations .foundations-setup') !== null)
}

/** How many badges each named token shows itself, so a foreground nested in a pair tile does not count. */
function ownBadges(page, names) {
  return page.evaluate((wanted) => {
    const doc = globalThis.specimenFrame().contentDocument
    const counts = {}

    for (const element of doc.querySelectorAll('[data-token]')) {
      if (wanted.includes(element.dataset.token)) {
        const badges = Array.from(element.querySelectorAll('.fd-badge'))
        counts[element.dataset.token] = badges.filter(
          (badge) => badge.closest('[data-token]') === element,
        ).length
      }
    }

    return counts
  }, names)
}

function originOf(page, name) {
  return page.evaluate(
    (wanted) =>
      Array.from(globalThis.specimenFrame().contentDocument.querySelectorAll('[data-token]'))
        .find((token) => token.dataset.token === wanted)
        ?.getAttribute('data-origin') ?? null,
    name,
  )
}

function variantSizes(page, names) {
  return page.evaluate((wanted) => {
    const doc = globalThis.specimenFrame().contentDocument
    const tokens = Array.from(doc.querySelectorAll('[data-token]'))

    return wanted.map((name) => {
      const sample = tokens
        .find((token) => token.dataset.token === name)
        ?.querySelector('[data-specimen]')

      return sample ? doc.defaultView.getComputedStyle(sample).fontSize : null
    })
  }, names)
}

/** The cases a Material UI output shares with the `--mui-*` copy. */
function intentProblems(blocks) {
  return INTENTS.flatMap((intent) => {
    const block = findBlock(blocks, 'colors', `mui-${intent}`)

    if (block?.tokens !== 4 || block.pairs !== 1) {
      return [`mui-${intent} has ${block?.tokens} tokens and ${block?.pairs} pairs`]
    }

    return []
  })
}

function muiPins(name) {
  return Object.fromEntries(
    Object.entries(MUI_CONTRAST).map(([intent, pins]) => [name(intent), pins]),
  )
}

async function checkMuiTheme(check, label, page) {
  const blocks = await everyBlock(page)
  const names = VARIANTS.map((variant) => `typography.${variant}`)

  await check(
    `${label}: six intent blocks of 4 with a pair tile each, mui-grey 14, mui-elevation 25, mui-z-index 8`,
    () => {
      const counts = [
        ['colors', 'mui-grey', 14],
        ['shadows', 'mui-elevation', 25],
        ['other', 'mui-z-index', 8],
      ].flatMap(([section, id, count]) => {
        const tokens = findBlock(blocks, section, id)?.tokens

        return tokens === count ? [] : [`${id} has ${tokens}`]
      })

      return outcome([...intentProblems(blocks), ...counts])
    },
  )

  await check(
    `${label}: mui-variants holds the 13 typography variants in order, each at its font size`,
    async () => {
      await showSection(page, 'typography')

      const variants = findBlock(blocks, 'typography', 'mui-variants')?.names ?? []

      return same(
        { variants, sizes: await variantSizes(page, names) },
        { variants: names, sizes: VARIANT_SIZES },
      )
    },
  )

  await checkContrast(
    check,
    label,
    page,
    muiPins((intent) => `palette.${intent}.contrastText`),
  )

  await check(
    `${label}: [data-origin="default"] per section reads ${MUI_DEFAULTS.map(([title, count]) => `${title} ${count}`).join(', ')} under bg=light and bg=dark`,
    async () => {
      const problems = []

      for (const bg of BACKGROUNDS) {
        const counts = []

        for (const [title] of MUI_DEFAULTS) {
          await showSection(page, idOf(title), bg)
          counts.push([title, await count(page, '[data-origin="default"]')])
        }

        if (JSON.stringify(counts) !== JSON.stringify(MUI_DEFAULTS)) {
          problems.push(`bg=${bg}: ${JSON.stringify(counts)}`)
        }
      }

      return outcome(problems)
    },
  )

  await check(
    `${label}: palette.primary.main, typography.h1 and shape.borderRadius have no badge, palette.error.main and typography.h2 one each`,
    async () => {
      const names = Object.keys(MUI_BADGES)
      const found = {}

      for (const section of ['colors', 'typography', 'radius']) {
        await showSection(page, section)
        Object.assign(found, await ownBadges(page, names))
      }

      return same(Object.fromEntries(names.map((name) => [name, found[name] ?? null])), MUI_BADGES)
    },
  )

  await check(`${label}: no block title has a badge, and no setup hint`, async () => {
    const titled = Object.values(blocks)
      .flat()
      .filter((block) => block.badge !== null)
      .map((block) => block.id)

    return same({ titled, setup: await setupShown(page) }, { titled: [], setup: false })
  })
}

/** Only the dark mode of the copy's primary is Material UI's default, so only `bg=dark` marks it. */
async function checkDefaultDarkPrimary(check, page) {
  const name = 'palette.primary.main'

  await check(
    `${MUI_DEFAULT_DARK_PRIMARY}: ${name} has no data-origin or badge under bg=light, and data-origin="default", one badge and rgb(144, 202, 249) under bg=dark`,
    async () => {
      const readings = []

      for (const bg of BACKGROUNDS) {
        await showSection(page, 'colors', bg)
        readings.push({
          origin: await originOf(page, name),
          badges: (await ownBadges(page, [name]))[name] ?? null,
          paint: await swatchColor(page, name),
        })
      }

      return same(readings, [
        { origin: null, badges: 0, paint: 'rgb(91, 75, 219)' },
        { origin: 'default', badges: 1, paint: 'rgb(144, 202, 249)' },
      ])
    },
  )
}

async function checkMuiVariables(check, page) {
  const label = MUI_VARIABLES_ONLY

  await check(
    `${label}: the sections read ${MUI_VARIABLE_SECTIONS.map(([title, count]) => `${title} ${count}`).join(', ')}, without the setup hint`,
    async () =>
      same(
        { sections: await sectionButtons(page), setup: await setupShown(page) },
        { sections: MUI_VARIABLE_SECTIONS, setup: false },
      ),
  )

  const blocks = await everyBlock(page)

  await check(
    `${label}: Colors starts with the intent blocks, mui-grey 14, mui-text 4, mui-background 2, mui-divider 1, mui-common 4`,
    () => {
      const expected = [
        ...INTENTS.map((intent) => [`mui-${intent}`, 4]),
        ['mui-grey', 14],
        ['mui-text', 4],
        ['mui-background', 2],
        ['mui-divider', 1],
        ['mui-common', 4],
      ]

      const actual = blockSummary((blocks.colors ?? []).slice(0, expected.length))

      return outcome([
        ...intentProblems(blocks),
        ...(JSON.stringify(actual) === JSON.stringify(expected)
          ? []
          : [`got ${JSON.stringify(actual)}`]),
      ])
    },
  )

  await check(
    `${label}: no token ends with Channel, and mui-primary's note starts with 4 …Channel`,
    () => {
      const channels = Object.values(blocks)
        .flat()
        .flatMap((block) => block.names)
        .filter((name) => name.endsWith('Channel'))

      const note = findBlock(blocks, 'colors', 'mui-primary')?.note ?? null
      const passed = channels.length === 0 && Boolean(note?.startsWith('4 …Channel'))

      return { passed, detail: JSON.stringify({ channels, note }) }
    },
  )

  await check(
    `${label}: mui-variants starts with the 13 --mui-font-<variant> in order, h1 at 40px`,
    async () => {
      await showSection(page, 'typography')

      const names = VARIANTS.map((variant) => `--mui-font-${variant}`)
      const variants = (findBlock(blocks, 'typography', 'mui-variants')?.names ?? []).slice(0, 13)
      const [h1] = await variantSizes(page, ['--mui-font-h1'])

      return same({ variants, h1 }, { variants: names, h1: '40px' })
    },
  )

  await check(`${label}: mui-elevation 25, mui-shape 1, mui-z-index 8`, () =>
    same(
      [
        findBlock(blocks, 'shadows', 'mui-elevation')?.tokens,
        findBlock(blocks, 'radius', 'mui-shape')?.tokens,
        findBlock(blocks, 'other', 'mui-z-index')?.tokens,
      ],
      [25, 1, 8],
    ),
  )

  await check(
    `${label}: Spacing shows --mui-spacing and 13 [data-step] rows, step 2 a 16 px bar`,
    async () => {
      await showSection(page, 'spacing')

      const scale = await readScale(page, 2)
      const base = await hasToken(page, '--mui-spacing')
      const passed = base && scale.steps === 13 && Math.abs(scale.width - 16) <= PIXEL_TOLERANCE

      return { passed, detail: JSON.stringify({ base, ...scale }) }
    },
  )

  await check(
    `${label}: --mui-palette-primary-main paints rgb(91, 75, 219) under bg=light and rgb(169, 156, 255) under bg=dark`,
    async () => {
      const colors = []

      for (const bg of BACKGROUNDS) {
        await showSection(page, 'colors', bg)
        colors.push(await swatchColor(page, '--mui-palette-primary-main'))
      }

      return same(colors, ['rgb(91, 75, 219)', 'rgb(169, 156, 255)'])
    },
  )

  await checkContrast(
    check,
    label,
    page,
    muiPins((intent) => `--mui-palette-${intent}-contrastText`),
  )
}

function entryText(page) {
  return page.evaluate(
    () => document.querySelector('.foundations-entry .foundations-systems')?.textContent ?? null,
  )
}

async function checkMuiWithoutTheme(check, page) {
  await check(
    `${MUI_WITHOUT_THEME}: the entry reads Material UI · Emotion, Colors 1, and the setup hint is the one sentence`,
    async () =>
      same(
        {
          entry: await entryText(page),
          sections: await sectionButtons(page),
          setup: await page.evaluate(
            () => document.querySelector('.foundations .foundations-setup')?.textContent ?? null,
          ),
        },
        { entry: 'Material UI · Emotion', sections: [['Colors', 1]], setup: SETUP_SENTENCE },
      ),
  )
}

function titled(block) {
  return block ? [block.id, block.title, block.prefix, block.tokens] : null
}

async function checkChakra(check, page) {
  const label = CHAKRA_COPY

  await check(
    `${label}: the entry reads Chakra UI and the sections ${CHAKRA_SECTIONS.map(([title, count]) => `${title} ${count}`).join(', ')}`,
    async () =>
      same(
        { entry: await entryText(page), sections: await sectionButtons(page) },
        { entry: 'Chakra UI', sections: CHAKRA_SECTIONS },
      ),
  )

  const blocks = await everyBlock(page)

  await check(`${label}: blocks by name prefix, then Custom properties`, () =>
    same(
      {
        colors: (blocks.colors ?? []).map(titled),
        typography: (blocks.typography ?? []).map(titled),
        others: CHAKRA_TITLES.map(([section]) => blocks[section]?.[0]?.title ?? null),
      },
      {
        colors: [
          ['prefix-chakra-colors', 'Chakra colors', '--chakra-colors-*', 6],
          ['custom-properties', 'Custom properties', null, 1],
        ],
        typography: [
          ['prefix-chakra-fonts', 'Chakra fonts', '--chakra-fonts-*', 2],
          ['prefix-chakra-font-sizes', 'Chakra font sizes', '--chakra-font-sizes-*', 2],
        ],
        others: CHAKRA_TITLES.map(([, title]) => title),
      },
    ),
  )

  await check(
    `${label}: --chakra-colors-bg paints rgb(255, 255, 255) under bg=light and rgb(24, 24, 27) under bg=dark`,
    async () => {
      const colors = []

      for (const bg of BACKGROUNDS) {
        await showSection(page, 'colors', bg)
        colors.push(await swatchColor(page, '--chakra-colors-bg'))
      }

      return same(colors, ['rgb(255, 255, 255)', 'rgb(24, 24, 27)'])
    },
  )
}

/** The named computed properties of each token's sample. */
function sampleStyles(page, wanted) {
  return page.evaluate((pins) => {
    const doc = globalThis.specimenFrame().contentDocument
    const tokens = Array.from(doc.querySelectorAll('[data-token]'))

    return Object.fromEntries(
      Object.entries(pins).map(([name, properties]) => {
        const sample = tokens
          .find((token) => token.dataset.token === name)
          ?.querySelector('[data-specimen]')

        if (!sample) {
          return [name, null]
        }

        const style = doc.defaultView.getComputedStyle(sample)

        return [name, Object.fromEntries(Object.keys(properties).map((key) => [key, style[key]]))]
      }),
    )
  }, wanted)
}

function tokenTexts(page, name) {
  return page.evaluate((wanted) => {
    const token = Array.from(
      globalThis.specimenFrame().contentDocument.querySelectorAll('[data-token]'),
    ).find((candidate) => candidate.dataset.token === wanted)

    return {
      value: token?.querySelector('[data-value]')?.textContent ?? null,
      parts: token?.querySelector('.fd-parts')?.textContent ?? null,
    }
  }, name)
}

async function checkTypeStyles(check, page) {
  const label = TYPE_STYLES_COPY

  await check(
    `${label}: the entry reads custom properties and the sections Colors 1, Typography 14`,
    async () =>
      same(
        { entry: await entryText(page), sections: await sectionButtons(page) },
        {
          entry: 'custom properties',
          sections: [
            ['Colors', 1],
            ['Typography', 14],
          ],
        },
      ),
  )

  await showSection(page, 'typography')
  const blocks = await readBlocks(page)

  await check(
    `${label}: each --type-<style>-* is one composite token, part-first scales form blocks, and a stem without a font size stays two rows`,
    () =>
      same(
        {
          blocks: blocks.map(titled),
          type: findBlock({ typography: blocks }, 'typography', 'prefix-type')?.names,
          rest: findBlock({ typography: blocks }, 'typography', 'custom-properties')?.names,
        },
        {
          blocks: TYPE_STYLES_BLOCKS,
          type: ['--type-display-*', '--type-title-*', '--type-body-*'],
          rest: ['--link-font-weight', '--link-letter-spacing', '--heading-*'],
        },
      ),
  )

  await check(
    `${label}: a composite paints its whole style through its custom properties, and a size, a line height, a letter spacing and a weight each paint a sample`,
    async () => same(await sampleStyles(page, TYPE_STYLES_SAMPLES), TYPE_STYLES_SAMPLES),
  )

  await check(
    `${label}: --type-display-* lists its parts in order, and --type-body-* shows its resolved font size`,
    async () =>
      same(
        {
          display: (await tokenTexts(page, '--type-display-*')).parts,
          body: (await tokenTexts(page, '--type-body-*')).value,
        },
        {
          display:
            'fontFamily var(--font-sans) · fontSize 3rem · fontWeight 700 · lineHeight 1.1 · letterSpacing -0.02em',
          body: 'var(--font-size-md) → 1rem',
        },
      ),
  )

  await check(
    `${label}: the filter finds --type-title-* by the name of a custom property it is made of`,
    async () => {
      const field = page.locator('.foundations .foundations-filter')
      await field.fill('--type-title-font-size')
      await waitForCount(page, 'typography', 1)
      const shown = await shownTokens(page)
      await field.press('Escape')
      await waitForCount(page, 'typography', 14)

      return same(shown, ['--type-title-*'])
    },
  )
}

async function checkPlain(check, label, page, expected) {
  await check(
    `${label}: Colors shows ${expected.map((block) => `${block[0]} ${block[3]}`).join(', ')}`,
    async () => {
      await showSection(page, 'colors')

      return same((await readBlocks(page)).map(titled), expected)
    },
  )
}

/** The query that hides Typography's web-font samples, and the Typography count it leaves. */
const REVEALED = {
  shadcn: ['brand', 0],
  'mui, MUI_CLASSIC=1': ['h1', 1],
  mui: ['h1', 1],
}

const CASES = {
  shadcn: (check, page, output) => checkShadcn(check, page, output),
  'mui, MUI_CLASSIC=1': (check, page) => checkMuiTheme(check, 'mui, MUI_CLASSIC=1', page),
  mui: (check, page) => checkMuiTheme(check, 'mui', page),
  [MUI_VARIABLES_ONLY]: (check, page) => checkMuiVariables(check, page),
  [MUI_WITHOUT_THEME]: (check, page) => checkMuiWithoutTheme(check, page),
  [MUI_DEFAULT_DARK_PRIMARY]: (check, page) => checkDefaultDarkPrimary(check, page),
  [CHAKRA_COPY]: (check, page) => checkChakra(check, page),
  [TYPE_STYLES_COPY]: (check, page) => checkTypeStyles(check, page),
  'react-jsdom': (check, page) =>
    checkPlain(check, 'react-jsdom', page, [
      ['theme-colors', 'Colors', 'colors.*', 3],
      ['custom-properties', 'Custom properties', null, 7],
    ]),
  'react-browser': (check, page) =>
    checkPlain(check, 'react-browser', page, [['custom-properties', 'Custom properties', null, 7]]),
}

async function openColors(browser, url) {
  const viewer = await openViewer(browser, url)
  await gotoViewer(viewer, url, '#foundations=colors&bg=light')
  await waitForFrame(viewer.page, 'colors')

  return viewer
}

/** Returns the failures of its page. */
async function checkFreshPage(check, browser, label, url) {
  const viewer = await openColors(browser, url)

  try {
    await checkRevealedFit(check, label, viewer.page, REVEALED[label])
  } finally {
    await viewer.close()
  }

  return viewer.failures
}

async function checkLabel(check, browser, label, url, output) {
  const failures = REVEALED[label] ? await checkFreshPage(check, browser, label, url) : []
  const viewer = await openColors(browser, url)

  try {
    await checkCounts(check, label, viewer.page)
    await CASES[label]?.(check, viewer.page, output)
  } finally {
    await viewer.close()
  }

  failures.push(...viewer.failures)

  await check(
    `${label}: no page error, console error or failed request in the preset cases`,
    () => ({
      passed: failures.length === 0,
      detail: [...new Set(failures)].join('; '),
    }),
  )
}

/**
 * Run the preset cases on every output and synthetic copy that `urls` names,
 * but the one without a specimen frame, with check-foundations' `check()` and
 * an open Chromium.
 */
export async function checkPresets({ check, browser, urls, outputs }) {
  const labels = [...Object.keys(outputs), ...Object.keys(COPIES)].filter(
    (label) => urls[label] && label !== HINT_ONLY,
  )

  for (const label of labels) {
    await checkLabel(check, browser, label, urls[label], outputs[label])
  }
}
