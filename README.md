# describe-me

**Your tests are your stories.** Living component documentation generated
from the unit tests you already have. No separate story abstraction.

A test is a sequence of steps: `render`, a few interactions, assertions.
describe-me captures the DOM after each step and shows the result as a
browsable catalog: `describe` blocks become the sidebar, each `it` is a story,
each step is a frame you can scrub through.

Stories cannot rot, because they are tests: if one drifts from the
component, CI goes red.

## Status

Prototype. React + Vitest browser mode only, static snapshots (no live mount).

## How it works

```
 browser (Vitest browser mode)                node
 ┌──────────────────────────────┐             ┌──────────────────────────────┐
 │ @describe-me/react   render()│  task.meta  │ @describe-me/vitest/reporter │
 │ @describe-me/vitest  userEvent│───────────▶│  writes .describe-me/        │
 │ @describe-me/core    recorder│             │    manifest.json             │
 │   rrweb-snapshot(document)   │             │    snapshots/<hash>.json     │
 └──────────────────────────────┘             └──────────────┬───────────────┘
                                                             │ fs.watch → HMR
                                              ┌──────────────▼───────────────┐
                                              │ @describe-me/viewer (Vite)   │
                                              │  sidebar · stage · timeline  │
                                              └──────────────────────────────┘
```

- `@describe-me/core` — framework-agnostic. The `recorder` (begin / capture /
  end), the `step()` helper, and the JSON manifest types. Snapshots are
  serialized DOM via rrweb-snapshot, so the viewer never needs your framework.
- `@describe-me/react` — a drop-in `render` for `vitest-browser-react` that
  records a frame after mount and after `rerender`, and extracts the component
  name and props. This is the only React-specific code.
- `@describe-me/vitest` — `setup` (beforeEach/afterEach hooks that hand frames
  to the reporter through `task.meta`), a `userEvent` proxy that records a
  frame after every interaction, and the Node `reporter` that writes the
  output directory.
- `@describe-me/viewer` — a vanilla-TS Vite app. Serves `.describe-me/` under
  `/__data`, replays snapshots into a sandboxed iframe, pushes an HMR event
  when the manifest changes.

Frames are captured after `render`, after each `userEvent.*` call, after each
`step()`, and at the end of the test if the DOM changed since the last frame.
A `step()` whose body already produced the current DOM just names that frame.

## Try it

```sh
pnpm install
pnpm build                       # builds core, react, vitest (tsc)
cd examples/react-basic
pnpm exec playwright install chromium
pnpm test                        # vitest run → writes .describe-me/
pnpm dev                         # vitest --watch + viewer on http://localhost:6006
```

## Writing tests that double as stories

```tsx
import { render, step } from '@describe-me/react'
import { userEvent } from '@describe-me/vitest'

describe('Counter', () => {
  it('does not go below the minimum', async () => {
    const screen = await render(<Counter initial={1} />)
    await step('go down to the minimum', () =>
      userEvent.click(screen.getByRole('button', { name: 'decrement' })),
    )
    await expect.element(screen.getByLabelText('value')).toHaveTextContent('0')
  })
})
```

A test with no assertion is a valid story. A story with an assertion is a
test. Same primitive.

## vitest.config.ts

```ts
import DescribeMeReporter from '@describe-me/vitest/reporter'

export default defineConfig({
  test: {
    setupFiles: ['@describe-me/vitest/setup'],
    reporters: ['default', new DescribeMeReporter()],
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
})
```

## Open questions / next

- Live mount: re-run a test up to frame N inside the viewer with HMR.
- Controls: generate a props panel from TypeScript types and re-render.
- Locator-method interactions (`screen.getByRole(...).click()`) are not
  intercepted yet; only `userEvent.*` and `step()` produce frames.
- CSS-in-JS / adopted stylesheets need checking beyond plain CSS imports.
- `vite build` for the viewer plus copying `.describe-me/` in → static docs.
- Vue / Svelte adapters: a `render` wrapper each, nothing else.

## Overhead

Measured on the example suite (12 tests, 24 frames) in headless Chromium,
5 runs per variant, medians. `pnpm bench:micro` / `pnpm bench:macro` in
`examples/react-basic`.

|                            | recording off | recording on | overhead               |
| -------------------------- | ------------- | ------------ | ---------------------- |
| sum of test durations      | 682 ms        | 689 ms       | +7 ms (0.3 ms / frame) |
| wall clock of `vitest run` | 1773 ms       | 1837 ms      | +64 ms (reporter I/O)  |

Per capture, by DOM size (median): 48 nodes 0.5 ms · 318 nodes 2 ms ·
3 000 nodes 11 ms · 15 000 nodes 60 ms. Above a few thousand nodes the
rrweb serialization dominates and hashing the JSON adds ~20 % on top.

The first version waited for `requestAnimationFrame` before every capture,
which cost a full vsync (~16 ms) per frame and made tests 1.8× slower.
A snapshot is DOM + stylesheets, not layout, so a single macrotask is enough
for React to commit; the rAF was removed.
