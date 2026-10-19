/**
 * The stage's note on the two MUI outputs with a theme module. The classic
 * output records only the light scheme's colors, so under `bg=dark` its frame
 * says it has only a light variant and that Material UI records both with
 * `cssVariables: true`. The default output records both, so it says neither.
 * check-site cannot show this case, because the site's MUI viewer is the
 * default output.
 */
import { gotoViewer, openViewer } from './view-page.mjs'

const CLASSIC = 'mui, MUI_CLASSIC=1'
const VARIABLES = 'mui'
const TEST = 'PlanCard > marks the popular plan'
const RECORDED_IFRAME = '.stage-slot[data-frame]:not(.incoming) iframe'
// The note's words, in packages/viewer/src/stage-note.ts.
const LIGHT_ONLY_WORDS = 'only a light variant'
const CSS_VARIABLES_WORDS = 'cssVariables: true'
const FRAME_WAIT = 15_000
const NOTE_WAIT = 5_000
// Neither phrase must still hold after this long, in case the note comes with the frame's fonts.
const SETTLE_MS = 300

function testIdOf(output) {
  const tests = output.manifest.modules.flatMap((module) => module.tests)

  return tests.find((test) => test.fullName === TEST)?.id
}

/** The note under the stage, read in the page: its text, empty while it is hidden. */
function stageNote() {
  const note = document.querySelector('.stage-note')

  return note === null || note.hidden ? '' : note.textContent
}

/**
 * Waits until the note says both phrases, or with `both` false until it says
 * neither and still does after SETTLE_MS. Returns a problem or `null`.
 */
async function showsNote(page, both) {
  const words = [LIGHT_ONLY_WORDS, CSS_VARIABLES_WORDS]
  const shown = await page
    .waitForFunction(
      ({ phrases, expected }) => {
        const note = document.querySelector('.stage-note')
        const text = note === null || note.hidden ? '' : note.textContent

        return phrases.every((phrase) => text.includes(phrase) === expected)
      },
      { phrases: words, expected: both },
      { timeout: NOTE_WAIT },
    )
    .then(() => true)
    .catch(() => false)

  if (shown && !both) {
    await page.waitForTimeout(SETTLE_MS)
  }

  const text = await page.evaluate(stageNote)
  const said = words.filter((phrase) => text.includes(phrase))

  if (shown && said.length === (both ? words.length : 0)) {
    return null
  }

  return both
    ? `the note says "${text}", expected "${LIGHT_ONLY_WORDS}" and "${CSS_VARIABLES_WORDS}"`
    : `the note says "${text}", expected neither "${LIGHT_ONLY_WORDS}" nor "${CSS_VARIABLES_WORDS}"`
}

async function pickBackground(page, value) {
  await page
    .getByRole('group', { name: 'Stage background' })
    .getByRole('button', { name: value, exact: true })
    .click()
}

async function gotoDark(viewer, url, id) {
  await gotoViewer(viewer, url, `#test=${id}&bg=dark`)
  await viewer.page.locator(RECORDED_IFRAME).waitFor({ timeout: FRAME_WAIT })
}

function outcome(problem) {
  return { passed: problem === null, detail: problem ?? undefined }
}

async function checkClassic(check, browser, url, id) {
  const viewer = await openViewer(browser, url)

  try {
    await check(
      `${CLASSIC}: #test=${id}&bg=dark says the frame has only a light variant and that cssVariables: true records both`,
      async () => {
        await gotoDark(viewer, url, id)

        return outcome(await showsNote(viewer.page, true))
      },
    )

    // `auto` resolves light, because the system is light and the classic page declares no scheme.
    await check(`${CLASSIC}: light, transparent and auto say neither`, async () => {
      for (const value of ['light', 'transparent', 'auto']) {
        await pickBackground(viewer.page, value)

        const problem = await showsNote(viewer.page, false)

        if (problem) {
          return outcome(`with ${value}: ${problem}`)
        }
      }

      return outcome(null)
    })
  } finally {
    await viewer.close()
  }

  return viewer.failures
}

async function checkVariables(check, browser, url, id) {
  const viewer = await openViewer(browser, url)

  try {
    await check(`${VARIABLES}: #test=${id}&bg=dark says neither`, async () => {
      await gotoDark(viewer, url, id)

      return outcome(await showsNote(viewer.page, false))
    })
  } finally {
    await viewer.close()
  }

  return viewer.failures
}

/**
 * Check the stage's note under `bg=dark` on the classic and the default MUI
 * output, with check-foundations' `check()`, a Chromium `browser`, the static
 * viewers' `urls` and the `outputs` they were built from.
 */
export async function checkStageNote({ check, browser, urls, outputs }) {
  const failures = [
    ...(await checkClassic(check, browser, urls[CLASSIC], testIdOf(outputs[CLASSIC]))),
    ...(await checkVariables(check, browser, urls[VARIABLES], testIdOf(outputs[VARIABLES]))),
  ]

  await check('stage note: no page error, console error or failed request', () => ({
    passed: failures.length === 0,
    detail: [...new Set(failures)].join('; '),
  }))
}
