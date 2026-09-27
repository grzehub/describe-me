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

Prototype. React, Vitest in browser mode or jsdom, static snapshots (no live mount).

## How it works

```
 browser (Vitest browser mode)                node
 ┌──────────────────────────────┐             ┌──────────────────────────────┐
 │ @describe-me/react   render()│  task.meta  │ @describe-me/vitest/reporter │
 │ @describe-me/vitest  userEvent│───────────▶│  writes .describe-me/        │
 │ @describe-me/core    recorder│             │    manifest.json             │
 │   rrweb-snapshot(document)   │             │    snapshots/<hash>.json     │
 │                              │             │    styles/<hash>.css         │
 │                              │             │    assets/<hash>.<ext>       │
 └──────────────────────────────┘             └──────────────┬───────────────┘
                                                             │ fs.watch → HMR
                                              ┌──────────────▼───────────────┐
                                              │ describe-me (Vite viewer)    │
                                              │  sidebar · stage · timeline  │
                                              └──────────────────────────────┘
```

- `@describe-me/core` — framework-agnostic. The `recorder` (begin / capture /
  end), the `step()` helper, and the JSON manifest types. Snapshots are
  serialized DOM via rrweb-snapshot, so the viewer never needs your framework.
- `@describe-me/react` — drop-in `render` functions that record a frame after
  mount and after `rerender`, and extract the component name and props: one
  for `vitest-browser-react`, one for `@testing-library/react`
  (`@describe-me/react/testing-library`). This is the only React-specific code.
- `@describe-me/vitest` — the `plugin` (one-line integration: detects the
  environment, registers the setup file and reporter, redirects `render`), two
  setup files (`setup` patches Vitest's `Locator` and `userEvent` in browser
  mode, `setup-dom` patches Testing Library's `userEvent` in jsdom; both add
  beforeEach/afterEach hooks that hand frames to the reporter through
  `task.meta`) and the Node `reporter` that writes the output directory.
- `describe-me` — the viewer: a vanilla-TS Vite app plus the CLI of the same name.
  `dev` serves `.describe-me/` under `__data/` with an HMR push when the
  manifest changes; `build` emits a static site with the data copied in.
  Snapshots replay into a sandboxed iframe.

Frames are captured after `render`, after every interaction, after each
`step()`, and at the end of the test if the DOM changed since the last frame.
A `step()` whose body already produced the current DOM just names that frame.
rrweb's node ids restart at 1 for every capture, so identical DOM serializes
to identical JSON and is stored in one snapshot file. Stylesheets of 256
characters or more are stored once in `styles/` and referenced from the
snapshots.

A test that records no frame before the closing one (no recording `render`,
no interaction, no `step()`) is left out of the manifest, even if it failed,
and costs no snapshot, so pure logic tests next to your components are free.
A test that renders outside the recording `render` (for example with
`createRoot` by hand) is therefore left out too. Call `step()` to keep it. A
test skipped in a filtered run (`-t`, `.only`, `.skip`) keeps what the last
run recorded for it.

Interactions are intercepted at the source: the setup file patches Vitest's
`Locator` action methods (`click`, `dblClick`, `tripleClick`, `fill`, `clear`,
`hover`, `unhover`, `wheel`, `dropTo`, `selectOptions`, `upload`) and the
keyboard-level `userEvent` methods (`type`, `keyboard`, `tab`, `copy`, `cut`,
`paste`). So `screen.getByRole('button').click()` and `userEvent.click(...)` from
`vitest/browser` record the same frame, and a gesture that delegates internally (`userEvent.click`
→ `locator.click`) records it once. In jsdom the same holds for
`@testing-library/user-event`: its direct API and `userEvent.setup()` instances
are patched, and `userEvent.click(el)` delegating to an instance records once.

## Try it

```sh
pnpm install
pnpm build                       # core, react, vitest (tsc) and the describe-me CLI
cd examples/react-browser
pnpm exec playwright install chromium
pnpm test                        # vitest run → writes .describe-me/
pnpm dev                         # vitest --watch + viewer on http://localhost:6006
pnpm docs:build                  # static site in docs-dist/, deploy anywhere
```

## Add it to your project

```sh
pnpm add -D describe-me @describe-me/vitest @describe-me/react
```

`vite` is a peer dependency of `describe-me` (Vitest requires it anyway). pnpm
and npm install peers automatically; with yarn, add `vite` to your
`devDependencies`.

Supported versions:

- Vite `^6.4 || ^7 || ^8`
- Vitest `^4 || ^5`
- React `^18 || ^19`
- `vitest-browser-react` `^2` (browser mode) or `@testing-library/react` `^16`
  (jsdom), whichever your tests use
- `@testing-library/user-event` `^14` (optional, DOM environments)
- TypeScript `^5 || ^6` (optional, used for props docs)
- Node: whatever your Vite and Vitest require. Vite 8 needs
  `^20.19.0 || >=22.12.0`; the `describe-me` CLI itself needs
  `^20.16.0 || >=22.4.0`.

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

For jsdom, the same line works with a jsdom config — see
[Environments](#environments).

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

## Environments

The plugin detects where the tests run and wires the matching pieces:

|                     | browser mode (`test.browser.enabled`) | DOM (`environment: 'jsdom'`)              |
| ------------------- | ------------------------------------- | ----------------------------------------- |
| redirected `render` | `vitest-browser-react`                | `@testing-library/react`                  |
| interactions        | `Locator` actions, `userEvent`        | `@testing-library/user-event`             |
| setup file          | `@describe-me/vitest/setup`           | `@describe-me/vitest/setup-dom`           |
| also sets           | —                                     | `test.css: true`, `RTL_SKIP_AUTO_CLEANUP` |

```sh
pnpm add -D describe-me @describe-me/vitest @describe-me/react \
  @testing-library/react @testing-library/user-event jsdom
```

```ts
export default defineConfig({
  plugins: [react(), describeMe()],
  test: { environment: 'jsdom' },
})
```

In jsdom the recording `render` stays synchronous, so
`const { asFragment } = render(...)` keeps working, and the redirect also
covers a custom `render` in your own `test-utils` that imports
`@testing-library/react`. `test.css` is switched on because Vitest stubs CSS
imports by default and every imported stylesheet would be missing from the
snapshots; an explicit `css: false` wins, with a warning. Testing Library's
auto-cleanup is switched off so the component is unmounted only after the
closing frame; describe-me unmounts it instead.

What differs is what happens **inside the test**. jsdom has no layout engine,
so anything the test measures, scrolls or observes (`IntersectionObserver`,
`getBoundingClientRect`) behaves differently, and user-event cannot tell
whether an element is covered by another. The frames themselves are the same
kind of thing in both: DOM plus stylesheets, laid out by a real browser in the
viewer. Pseudo-class states such as `:hover` or `:focus-visible` are not part
of the DOM, so they do not survive a snapshot in either environment; a hover
shows up only when the component puts it into the DOM.

`examples/react-jsdom` is the jsdom counterpart of `examples/react-browser`. Only
jsdom is tested; happy-dom is untested.

## Plugin options

| Option                         | Default          | Effect                                                                                                        |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `enabled`                      | `true`           | `false` runs the same tests without recording, e.g. for benchmarks.                                           |
| `framework`                    | `'react'`        | Which framework adapter replaces the test library's `render`.                                                 |
| `environment`                  | detected         | `'browser'` or `'dom'`: `browser` when `test.browser.enabled` is set, `dom` otherwise.                        |
| `outDir`                       | `'.describe-me'` | Output directory, relative to the Vitest root.                                                                |
| `registerExports`              | `true`           | Name components after their export, see [Component overview](#component-overview).                            |
| `styledComponentsBrowserBuild` | `true`           | DOM environments: load the browser build of styled-components, see [Global styles](#global-styles-and-fonts). |
| `include`                      | every test file  | Test files to record.                                                                                         |
| `exclude`                      | none             | Test files never to record. Wins over `include`.                                                              |

`include` and `exclude` take a glob or a list of globs, matched with
[picomatch](https://github.com/micromatch/picomatch) against the test file's
path relative to the Vitest root, dotfiles included. A leading `./` is
ignored, and `exclude` wins over `include`. Tests in other files still run
and report as usual, but record nothing, and their modules leave the
manifest, including ones kept from an earlier run.

Concurrent tests (`test.concurrent`, `describe.concurrent`,
`sequence.concurrent`) are never recorded, because they would share one
recorder. The setup file warns once per file.

```ts
describeMe({
  // document the components, not the slow integration suites
  include: 'src/components/**',
  exclude: ['**/*.integration.test.tsx'],
})
```

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
For jsdom, use `@describe-me/vitest/setup-dom`, import `render` from
`@describe-me/react/testing-library`, and set `css: true` and
`env: { RTL_SKIP_AUTO_CLEANUP: 'true' }` yourself.

The reporter accepts the same `include` and `exclude`
(`new DescribeMeReporter({ exclude: '**/*.integration.test.tsx' })`) and
filters the manifest with them. Only the plugin hands them to the setup file,
so a hand-wired setup still records, and pays for, every test.

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

A component is named after its export. The plugin appends a line to every
project module (not tests, not `node_modules`) that registers its top-level
exports, so `export const Button = forwardRef(<T,>(…) => …)` is `Button` and
`export const Text = styled.p` is `Text`, although neither has a usable
`displayName`. Without the registration (`registerExports: false`, or a module
outside the project) the name falls back to `displayName`, then the function
name, then whatever `memo` / `forwardRef` wrap.

The reporter reads the props type of that export with TypeScript: name, type,
required, default value from the destructuring pattern (also through
`forwardRef(…)` and `memo(…)`), JSDoc description. When the export was not
registered, it finds the file by following the test's import instead. Props
inherited from library types (`ButtonHTMLAttributes`) are left out. The whole
step costs about 0.1–0.2 s per run on the example.

## Diagnostics

After each run the reporter prints one warning line for each thing it could
not document: tests that render an anonymous component, components without
props docs, assets that were not found. The viewer shows the same list behind
an "issues" chip in its header, with links to the tests. `pnpm check-manifest`
fails on any of them in this repository's examples.

## Styling techniques

A snapshot is DOM plus stylesheets, so how styles reach the page matters.
Verified by `StyledText.test.tsx` in both examples: the browser-mode replay is
checked for computed colours, and `pnpm check-styles` in `examples/react-jsdom`
checks that each rule is in the jsdom snapshots:

| Technique                                  | Used by                                                                                          | Browser mode                                            | jsdom                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| `style={{ … }}` attributes                 | everyone                                                                                         | yes                                                     | yes                                               |
| `<style>` / `<link>` in the document       | CSS imports, CSS modules, Tailwind, vanilla-extract, dev builds of emotion and styled-components | yes                                                     | yes, CSS imports need `test.css` (plugin sets it) |
| CSSOM `insertRule` into an empty `<style>` | emotion and styled-components in production ("speedy") mode                                      | yes, rrweb reads `cssRules`                             | yes, simple rules verified                        |
| `document.adoptedStyleSheets`              | Lit and other web components                                                                     | yes, mirrored into a temporary `<style>` during capture | no: jsdom has no constructable stylesheets        |
| `adoptedStyleSheets` on a shadow root      | web components with shadow DOM                                                                   | not yet                                                 | no                                                |

In jsdom, rules go through jsdom's own CSS parser, which drops what it does
not understand. Simple rules are verified; nesting, `@layer` and `@container`
are not yet.

## Global styles and fonts

The viewer shows the DOM and the CSS that were on the page during the test,
nothing more. A reset, a `body { font-family }` or a web font that your app or
Storybook adds around every component must therefore be there in the test too,
or buttons show up with the browser's grey default and text in Times. Put them
in the wrapper of your custom `render`, the same place as your providers:

```tsx
// test-utils.tsx
import { render, type RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { GlobalStyles, theme } from './styles'

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {children}
    </ThemeProvider>
  )
}

function customRender(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

export * from '@testing-library/react'
export { customRender as render }
```

Fonts loaded with a `<link>` (Google Fonts and the like) can be added once in a
setup file; the link is captured with the snapshot and loads in the viewer.

**styled-components in jsdom.** Vitest loads the Node build of
styled-components (5 and 6), whose `createGlobalStyle` never inserts its CSS
on the client, so `<GlobalStyles />` silently does nothing in jsdom. The plugin
therefore points `styled-components` at its browser build and pre-bundles it
together with `jest-styled-components`, so both share one instance and
`toMatchSnapshot` output stays the same. Turn it off with
`describeMe({ styledComponentsBrowserBuild: false })`.

## Assets

Images, videos, local fonts and CSS `url()`s that point at project files are
copied into `.describe-me/assets/` when the snapshots are written, so they load
in `describe-me dev` and in the static build. rrweb records them as absolute
URLs on the test page (`http://localhost:3000/src/logo.svg` in jsdom, the Vitest
server in browser mode), which stop working once the tests end. A file is
looked up under the project root, then `public/`; paths that cannot be found
are listed as `assetsMissing` in the manifest and in the diagnostics. Links to
pages (`<a href="/">`) are left alone.

## Output directory

The reporter writes everything the viewer shows into `.describe-me/` (the
plugin's `outDir` option):

- `manifest.json`: modules, tests, frames, component docs and diagnostics.
- `snapshots/<hash>.json`: the serialized DOM of each frame.
- `styles/<hash>.css`: the snapshots' stylesheets, in chunks.
- `assets/<hash>.<ext>`: project files that snapshots and stylesheets point at.

Every file but the manifest is named after a hash of its content, so identical
DOM is stored once, however many frames, tests and runs produce it. A
stylesheet of 256 characters or more moves out of the snapshot, which keeps a
reference (`describe-me-style:<hash>+<hash>…`). The sheet is split between
top-level rules into chunks of about 4 KB, and the rules decide where a chunk
ends. A large styled-components sheet that grows from test to test therefore
shares most of its chunks, and each rule is stored about once. Shorter sheets
stay inline.

After every test run, garbage collection deletes the snapshots no frame points
at, then the style chunks no kept snapshot refers to, then the assets no kept
snapshot or chunk refers to. A font or image used only from CSS is therefore
kept. `describe-me build` copies the directory into the static site as
`__data/`.

The viewer reads output written by 0.4. A 0.4 viewer cannot read this output
(frames show without their stylesheets), so upgrade `describe-me` together with
`@describe-me/vitest`.

## Switches

There is no `.env`: nothing here is per-environment configuration or a secret.
The variables below are one-shot switches for the examples' benchmarks, set
inline for a single run. `BENCH_MICRO` works in both examples, the other two in
`examples/react-browser`.

| Variable           | Effect                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| `DESCRIBE_ME=off`  | Same tests, recording disabled (baseline for `bench:macro`).                  |
| `BENCH_OUT=<file>` | Replace the console reporter with JSON per-test durations.                    |
| `BENCH_MICRO=1`    | Run `bench/` instead of `src/` (capture cost by DOM size), in either example. |

`DESCRIBE_ME_DIR` is set by the `describe-me` CLI for the viewer; use `--data`
instead of setting it yourself.

## Overhead

Measured on the example suite (12 tests, 24 frames) in headless Chromium,
5 runs per variant, medians. `pnpm bench:micro` / `pnpm bench:macro` in
`examples/react-browser`; `pnpm bench:micro` in `examples/react-jsdom` measures
the same captures in jsdom.

|                            | recording off | recording on | overhead               |
| -------------------------- | ------------- | ------------ | ---------------------- |
| sum of test durations      | 682 ms        | 689 ms       | +7 ms (0.3 ms / frame) |
| wall clock of `vitest run` | 1773 ms       | 1837 ms      | +64 ms (reporter I/O)  |

Per `step()` capture, by DOM size (median): 48 nodes 0.5 ms · 318 nodes 1.5 ms ·
3 000 nodes 10 ms · 15 000 nodes 58 ms in Chromium; 35 nodes 2 ms · 305 nodes
3.4 ms · 3 000 nodes 26 ms · 15 000 nodes 135 ms in jsdom, where the 1 ms
`setTimeout(0)` of the settle is part of every capture. Most of it is rrweb's
serialization; `JSON.stringify` of the result is another 10–15 %, and comparing
that text with the previous frame's takes at most about 0.5 ms at 15 000 nodes.

The first version waited for `requestAnimationFrame` before every capture,
which cost a full vsync (~16 ms) per frame and made tests 1.8× slower.
A snapshot is DOM + stylesheets, not layout, so a single macrotask is enough
for React to commit; the rAF was removed.
