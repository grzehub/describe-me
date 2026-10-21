import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../docs/repo-root.mjs'
import { fragmentBetween } from './fragment-between.mjs'
import { linesBetween } from './lines-between.mjs'

const TEST_FILE = 'examples/shadcn/src/components/signup-card.test.tsx'
const MOUNTED = 'mounted as the test arranged it'
const LIVE_IFRAME = '.stage-slot.live-slot iframe'

/** The two SignupCard stories, told the same way: the test, its frames, Live, then Foundations. */
export const SIGNUP_STORIES = {
  submits: {
    test: 'SignupCard > submits the email',
    block: ["it('submits the email'", '  })'],
    frames: [
      ['render(<SignupCard'],
      ["step('type the email'", '    })'],
      ["name: 'Request access' }))", '  })'],
    ],
    async live(stage) {
      const frame = stage.viewer.frameLocator(LIVE_IFRAME)

      await stage.click(frame.getByRole('textbox', { name: 'Email' }), { settleMs: 200 })
      await stage.type('ada@example.com')
      await stage.pause(500)
      await stage.click(frame.getByRole('button', { name: 'Request access' }), { settleMs: 2400 })
    },
  },
  rejects: {
    test: 'SignupCard > rejects an empty email',
    block: ["it('rejects an empty email'", '  })'],
    frames: [['render(<SignupCard'], ["name: 'Request access' }))", '  })']],
    async live(stage) {
      const frame = stage.viewer.frameLocator(LIVE_IFRAME)

      await stage.click(frame.getByRole('button', { name: 'Request access' }), { settleMs: 2400 })
    },
  },
}

/** The describe block with the story's test alone, so the code pane shows one thing. */
function storyText(story) {
  const file = readFileSync(join(repoRoot, TEST_FILE), 'utf8')
  const describeLine = fragmentBetween(file, "describe('SignupCard'")

  return `${describeLine}\n${fragmentBetween(file, ...story.block)}\n})`
}

/** Record one SignupCard story on `stage`, whose viewer already shows its first frame. */
export async function signupScenario(stage, story) {
  const text = storyText(story)
  const lines = (range) => linesBetween(text, ...range)

  await stage.setCode({ file: 'signup-card.test.tsx', language: 'tsx', text })
  await stage.focus('code')
  await stage.caption('A Vitest test, the way you already write it.', 2300)

  await stage.focus('viewer')
  await stage.term([{ kind: 'prompt', text: '$ vitest run' }])
  await stage.caption(
    'Run it. <em>describe-me</em> records a frame after every render and every interaction.',
    700,
  )

  await stage.term([
    { kind: 'prompt', text: '$ vitest run' },
    { kind: 'ok', text: '  ✓ 13 tests passed' },
  ])

  await stage.pause(700)
  await stage.term([
    { kind: 'prompt', text: '$ vitest run' },
    { kind: 'ok', text: '  ✓ 13 tests passed' },
    { kind: 'prompt', text: '$ describe-me dev' },
    { kind: 'url', text: '  viewer at http://localhost:4173' },
  ])

  await stage.pause(1300)

  // Chip by chip along the timeline, the line that made the frame lit under it.
  await stage.focus('both')
  await stage.caption(
    'Every step of the test is a part of the story. <em>Stories cannot rot</em>, because they are tests.',
    0,
  )

  for (let index = 0; index < story.frames.length; index += 1) {
    await stage.click(stage.viewer.locator('.timeline .frame').nth(index), { settleMs: 150 })
    await stage.hot(lines(story.frames[index]))
    await stage.pause(1800)
  }

  await stage.hot(lines(story.frames[0]))
  await stage.click(stage.viewer.locator('.live-toggle:not([aria-disabled])'), { settleMs: 0 })
  await stage.viewer
    .locator('.live-section .live-status', { hasText: MOUNTED })
    .waitFor({ state: 'visible', timeout: 30_000 })

  await stage.caption(
    '<em>Live</em>: the component mounts for real, as the test arranged it. Use it.',
    700,
  )

  await story.live(stage)

  await stage.end(3200)
}
