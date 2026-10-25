import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../docs/repo-root.mjs'
import { fragmentBetween } from './fragment-between.mjs'
import { linesBetween } from './lines-between.mjs'

const TEST_FILE = 'examples/shadcn/src/components/ui/button.test.tsx'
const CONFIG_FILE = 'examples/shadcn/vitest.config.ts'
const HOVER = ["it('highlights a ghost button on hover'", '  })']
const FOCUS = ["it('shows its focus ring from the keyboard'", '  })']
const FOCUS_TEST = 'shows its focus ring from the keyboard'

/** The test the states demo opens on: its closing frame holds the hover. */
export const STATES_TEST = 'Button > highlights a ghost button on hover'

function read(file) {
  return readFileSync(join(repoRoot, file), 'utf8')
}

/** The describe block with the hover and the focus test alone. */
function buttonText() {
  const file = read(TEST_FILE)
  const describeLine = fragmentBetween(file, "describe('Button'")

  return [describeLine, fragmentBetween(file, ...HOVER), '', fragmentBetween(file, ...FOCUS), '})']
    .join('\n')
    .replace(/\n\n    \/\/ A ghost button[^\n]*\n/, '\n')
}

/** The plugin call of the config, which holds the groups. */
function configText() {
  return fragmentBetween(read(CONFIG_FILE), 'describeMe({', '    }),')
}

/** Record hover and focus in the frames, then the sidebar's groups, on `stage`. */
export async function statesScenario(stage) {
  const tests = buttonText()
  const lines = (text, range) => linesBetween(text, ...range)

  await stage.setCode({ file: 'button.test.tsx', language: 'tsx', text: tests })
  await stage.focus('code')
  await stage.hot(lines(tests, HOVER))
  await stage.caption('A hover in the test. The frame keeps it.', 2600)

  // The render frame first, so the hover shows against the button as it was.
  await stage.focus('both')
  await stage.click(stage.viewer.locator('.timeline .frame').nth(0), { settleMs: 150 })
  await stage.hot(lines(tests, ['render(<Button variant="ghost">']))
  await stage.pause(1600)
  await stage.click(stage.viewer.locator('.timeline .frame').nth(1), { settleMs: 150 })
  await stage.hot(lines(tests, ['await button.hover()']))
  await stage.caption(
    'Frames record <em>:hover</em>, <em>:focus-visible</em> and <em>:focus-within</em>. The browser decides, the viewer replays.',
    3400,
  )

  await stage.click(stage.viewer.locator('.sidebar .test', { hasText: FOCUS_TEST }), {
    settleMs: 1200,
  })

  await stage.click(stage.viewer.locator('.timeline .frame').nth(1), { settleMs: 150 })
  await stage.hot(lines(tests, ['await userEvent.tab()']))
  await stage.caption('Tab in the test, focus ring in the docs. No story to write for it.', 3200)

  const config = configText()

  await stage.setCode({ file: 'vitest.config.ts', language: 'tsx', text: config })
  await stage.focus('code')
  await stage.hot(
    lines(config, ["'Components/ui'", "          Components: 'src/components/*.test.tsx',"]),
  )

  await stage.caption('Group the sidebar the way the repo is laid out. Two lines of config.', 2600)

  await stage.focus('viewer')
  await stage.hot([])

  const ui = stage.viewer.locator('[data-group="Components/ui"] > .group-row')

  await stage.click(ui, { settleMs: 1400 })
  await stage.click(ui, { settleMs: 1000 })
  await stage.caption('Closed groups stay closed, per project. The search looks into them.', 0)
  await stage.click(stage.viewer.locator('[data-group="Components"] > .group-row'), {
    settleMs: 1400,
  })

  await stage.click(stage.viewer.locator('[data-group="Components"] > .group-row'), {
    settleMs: 1200,
  })

  await stage.end(3200)
}
