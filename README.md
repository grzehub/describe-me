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
- `@describe-me/vitest` — the `plugin` (one-line integration: setup file,
  reporter, `render` redirect), `setup` (patches Vitest's `Locator` and
  `userEvent` so every interaction records a frame, plus beforeEach/afterEach
  hooks that hand frames to the reporter through `task.meta`) and the Node
  `reporter` that writes the output directory.
- `@describe-me/viewer` — a vanilla-TS Vite app plus the `describe-me` CLI.
  `dev` serves `.describe-me/` under `__data/` with an HMR push when the
  manifest changes; `build` emits a static site with the data copied in.
  Snapshots replay into a sandboxed iframe.

Frames are captured after `render`, after every interaction, after each
`step()`, and at the end of the test if the DOM changed since the last frame.
A `step()` whose body already produced the current DOM just names that frame.

Interactions are intercepted at the source: the setup file patches Vitest's
`Locator` action methods (`click`, `dblClick`, `tripleClick`, `fill`, `clear`,
`hover`, `unhover`, `wheel`, `dropTo`, `selectOptions`, `upload`) and the
keyboard-level `userEvent` methods (`type`, `keyboard`, `tab`, `copy`, `cut`,
`paste`). So `screen.getByRole('button').click()` and `userEvent.click(...)` from
`vitest/browser` record the same frame, and a gesture that delegates internally (`userEvent.click`
→ `locator.click`) records it once.

## Try it

```sh
pnpm install
pnpm build                       # core, react, vitest (tsc) and the describe-me CLI
cd examples/react-basic
pnpm exec playwright install chromium
pnpm test                        # vitest run → writes .describe-me/
pnpm dev                         # vitest --watch + viewer on http://localhost:6006
pnpm docs:build                  # static site in docs-dist/, deploy anywhere
```

## Add it to your project

```sh
pnpm add -D @describe-me/vitest @describe-me/react @describe-me/viewer
```

```ts
// vitest.config.ts
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
})
```

That is the whole integration. The plugin registers the setup file and the
reporter, and redirects `import { render } from 'vitest-browser-react'` to the
recording adapter, so existing tests produce frames without any edits.
`step()` is the only opt-in, imported from `@describe-me/vitest`.

```sh
describe-me dev                  # viewer with live updates while vitest --watch runs
describe-me build --out docs     # self-contained static site: viewer + __data/
```

The static site uses relative URLs, so it works from a sub-path such as
GitHub Pages. `.github/workflows/docs.yml` shows the CI shape: test, build,
deploy.

## Writing tests that double as stories

```tsx
import { render, step } from '@describe-me/react'
import { userEvent } from 'vitest/browser'

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

## Without the plugin

The pieces can be wired by hand if you prefer explicit config:

```ts
import DescribeMeReporter from '@describe-me/vitest/reporter'

export default defineConfig({
  test: {
    setupFiles: ['@describe-me/vitest/setup'],
    reporters: ['default', new DescribeMeReporter()],
  },
})
```

Then import `render` from `@describe-me/react` instead of `vitest-browser-react`.

## Open questions / next

- Controls: turn the props table into inputs and mount the component live
  (dev only, via a playground endpoint on the Vitest server).
- Live mount: re-run a test up to frame N inside the viewer with HMR.
- `adoptedStyleSheets` inside shadow roots are not mirrored yet.
- Vue / Svelte adapters: a `render` wrapper each, nothing else.

## Component overview

Click a `describe` block or a test file in the sidebar to get the component
page: its props read from TypeScript, which values the tests actually cover,
and the final frame of every test as a thumbnail.

```
variant   'primary' | 'secondary' | 'ghost' | 'danger'   primary ✓ (default)  secondary ✓  ghost ✓  danger ✗
size      'sm' | 'md' | 'lg'                             sm ✓  md ✓ (default)  lg ✓
loading   boolean                                        true ✓  false ✓ (default)
children  ReactNode                                      passed in 7 of 7 tests
```

A red cross is an invitation to write a test. Coverage is computed from the
props recorded in `render` frames: a literal or boolean value counts when some
test passed it, and the default counts when some test omitted the prop.

The reporter finds each component by following the test file's import with
TypeScript's own module resolution, then reads the props type of the exported
function: name, type, required, default value from the destructuring pattern,
JSDoc description. Props inherited from library types (`ButtonHTMLAttributes`)
are left out. The whole step costs about 0.1–0.2 s per run on the example.

## Styling techniques

A snapshot is DOM plus stylesheets, so how styles reach the page matters.
Verified by `StyledText.test.tsx` in the example, whose replay is checked for
computed colours:

| Technique                                  | Used by                                                                                          | Captured                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `style={{ … }}` attributes                 | everyone                                                                                         | yes                                                     |
| `<style>` / `<link>` in the document       | CSS imports, CSS modules, Tailwind, vanilla-extract, dev builds of emotion and styled-components | yes                                                     |
| CSSOM `insertRule` into an empty `<style>` | emotion and styled-components in production ("speedy") mode                                      | yes, rrweb reads `cssRules`                             |
| `document.adoptedStyleSheets`              | Lit and other web components                                                                     | yes, mirrored into a temporary `<style>` during capture |
| `adoptedStyleSheets` on a shadow root      | web components with shadow DOM                                                                   | not yet                                                 |

## Switches

There is no `.env`: nothing here is per-environment configuration or a secret.
The variables below are one-shot switches for the example's benchmarks, set
inline for a single run.

| Variable           | Effect                                                       |
| ------------------ | ------------------------------------------------------------ |
| `DESCRIBE_ME=off`  | Same tests, recording disabled (baseline for `bench:macro`). |
| `BENCH_OUT=<file>` | Replace the console reporter with JSON per-test durations.   |
| `BENCH_MICRO=1`    | Run `bench/` instead of `src/` (capture cost by DOM size).   |

`DESCRIBE_ME_DIR` is set by the `describe-me` CLI for the viewer; use `--data`
instead of setting it yourself.

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
