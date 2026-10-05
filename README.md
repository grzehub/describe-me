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
`step()`, and at the end of the test if the DOM changed since the last frame
and the page still shows something. The render frame can also wait for async
content, see [Render frame timing](#render-frame-timing).
A `step()` whose body already produced the current DOM just names that frame.
Frames keep the order the test asked for them in. A capture still running
when its test ends, such as an interaction the test did not await, is
dropped.
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
`fireEvent` from `@testing-library/react` records one frame per call too,
labelled like `click(button "Save")` or `change(text "Name", "hello")`.

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

Install and upgrade `describe-me`, `@describe-me/vitest` and
`@describe-me/react` at one version, and `@describe-me/core` too if you list
it. One Renovate or Dependabot group for all of them does that.
`@describe-me/react` peers on `@describe-me/vitest`, which has an optional peer
on `describe-me`, so the package manager warns about a mix.
[Output directory](#output-directory) describes the check that catches one at
run time. The packages of one release reach npm minutes apart. A release
cooldown such as pnpm's `minimumReleaseAge` can therefore pass some of them and
hold back others. Upgrade once the whole release is past the cooldown.

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

[Viewer](#viewer) lists the flags and what the viewer can do. The static site
uses relative URLs, so it works from a sub-path such as GitHub Pages.
`.github/workflows/docs.yml` shows the CI shape: test, build, deploy.

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

|                     | browser mode (`test.browser.enabled`) | DOM (`environment: 'jsdom'`)               |
| ------------------- | ------------------------------------- | ------------------------------------------ |
| redirected `render` | `vitest-browser-react`                | `@testing-library/react`                   |
| interactions        | `Locator` actions, `userEvent`        | `@testing-library/user-event`, `fireEvent` |
| setup file          | `@describe-me/vitest/setup`           | `@describe-me/vitest/setup-dom`            |
| also sets           | —                                     | `test.css: true`, `RTL_SKIP_AUTO_CLEANUP`  |

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
snapshots. An explicit `css: false` wins, with a warning.

Testing Library's auto-cleanup is switched off so the component is unmounted
only after the closing frame. describe-me unmounts it instead, after every
test. Everything else behaves as with plain Testing Library:

- `renderHook` records no frames, but its tree is unmounted after each test too.
- `afterEach(cleanup)` in a test file is safe. `cleanup` records the last state
  before it unmounts.
- Fake timers are safe. The recorder keeps the real `setTimeout`, so
  `vi.useFakeTimers()` left on never hangs a capture.
- Switching auto-cleanup off also skips Testing Library's
  `IS_REACT_ACT_ENVIRONMENT` setup, so `setup-dom` sets the flag where Testing
  Library would (with Vitest globals). React's act warnings match a run
  without describe-me.
- `@testing-library/user-event` is optional.

`examples/react-jsdom` is the jsdom counterpart of `examples/react-browser`. Only
jsdom is tested; happy-dom is untested.

### Limitations in jsdom

jsdom has no layout engine and loads nothing, so what differs is what happens
**inside the test**. The frames themselves are the same kind of thing in both
environments: DOM plus stylesheets, laid out by a real browser in the viewer.

- **Positioned popovers.** Tooltips, menus and dropdowns placed by
  floating-ui, Popper, Radix and similar libraries show up in the top-left
  corner. The library computes the position from `getBoundingClientRect()`,
  which returns zeros in jsdom, and writes it into the DOM as `top`/`left` or
  a `transform`. The viewer replays those numbers. Record such tests in
  browser mode, or keep them in their own files and leave those out with
  `exclude` (see [Plugin options](#plugin-options)).
- **Layout, scrolling and observers.** Anything the test measures, scrolls or
  observes (`IntersectionObserver`, `getBoundingClientRect`) behaves
  differently, and user-event cannot tell whether an element is covered by
  another. jsdom has no `ResizeObserver` or `IntersectionObserver` unless the
  test stubs them.
- **Fonts.** Web fonts never load during a jsdom test, so the test measures
  text in fallback fonts. Only the viewer shows the real ones (see
  [Fonts](#fonts)). A `<link>` added by a font loader never loads, and every
  capture sets a 5 s timer for it.
- **Canvas.** Without the `canvas` package, `getContext()` returns `null` in
  jsdom, so the test cannot draw. Snapshots hold no canvas pixels in either
  environment, so a `<canvas>` is blank in the viewer.
- **`fireEvent` inside your own `act()`** records before React flushes, so its
  frame shows the DOM from before the update.

Two limits apply in browser mode too. Concurrent tests (`test.concurrent`,
`describe.concurrent`, `sequence.concurrent`) are never recorded, because they
would share one recorder (see [Plugin options](#plugin-options)). Pseudo-class
states such as `:hover` or `:focus-visible` are not part of the DOM, so they do
not survive a snapshot in either environment. A hover shows up only when the
component puts it into the DOM.

## Plugin options

| Option                         | Default          | Effect                                                                                                        |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `enabled`                      | `true`           | `false` runs the same tests without recording, e.g. for benchmarks.                                           |
| `framework`                    | `'react'`        | Which framework adapter replaces the test library's `render`.                                                 |
| `environment`                  | detected         | `'browser'` or `'dom'`: `browser` when `test.browser.enabled` is set, `dom` otherwise.                        |
| `outDir`                       | `'.describe-me'` | Output directory, relative to the Vitest root.                                                                |
| `registerExports`              | `true`           | Name components after their export, see [Component overview](#component-overview).                            |
| `styledComponentsBrowserBuild` | `true`           | DOM environments: load the browser build of styled-components, see [Global styles](#global-styles-and-fonts). |
| `include`                      | every test file  | Test files to record. An empty list records none, with a warning.                                             |
| `exclude`                      | none             | Test files never to record. Wins over `include`.                                                              |
| `previewHead`                  | none             | HTML the viewer adds to the start of every frame's `<head>`, see [Fonts](#fonts).                             |
| `renderFrame`                  | `'eager'`        | When the render frame is taken, see [Render frame timing](#render-frame-timing).                              |

`include` and `exclude` take a glob or a list of globs, matched with
[picomatch](https://github.com/micromatch/picomatch) against the test file's
path relative to the Vitest root, dotfiles included. A leading `./` is
ignored, and `exclude` wins over `include`. Tests in other files still run
and report as usual, but record nothing, and their modules leave the
manifest, including ones kept from an earlier run.

Leave `include` out to record every test file. `include: []` records none,
and the reporter warns when Vitest starts. To keep the plugin on (setup file,
render redirect, CSS handling) and record nothing, use `exclude: '**'`, which
does not warn. `enabled: false` removes the plugin instead.

With `test.projects` entries that set their own `root`, the two sides disagree
on the path. The test run matches `include` and `exclude` against the path
relative to the project root, the reporter against the path relative to the
Vitest root. With `include: 'src/**'` and a project root of `packages/app`, a
file records frames but its module is missing from the manifest. In such a
setup, use globs that start with `**/`, such as `**/src/components/**`, which
match both forms, or leave out `include` and `exclude`.

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

## Render frame timing

A component behind async providers or data loading shows a loader first. The
render frame is taken right after mount by default, so the docs show that
loader. `renderFrame` takes the frame later:

| `renderFrame`           | The render frame is taken                                                      |
| ----------------------- | ------------------------------------------------------------------------------ |
| `'eager'` (default)     | right after mount                                                              |
| `'lazy'`                | right before the test's next interaction, or at the end of the test            |
| `{ pending, timeout? }` | as soon as nothing matches the CSS selector `pending` and the page has content |

```ts
describeMe({
  // the loader the app's providers show until they are ready
  renderFrame: { pending: '[data-testid="app-loader"]' },
})
```

Every `render` frame follows the option, `rerender` included. An interaction
is a user event, `fireEvent`, `step()`, another `render`, `rerender`,
`unmount` or `cleanup`. `pending` watches the page with a `MutationObserver`.
It falls back to `'lazy'` after `timeout` ms (default 2000), or at the next
interaction if that comes first. A `pending` selector the test environment
cannot parse falls back to `'lazy'` too, with one warning per test file.

In browser mode, `await render()` returns before a deferred frame is taken.
Polling with `expect.element` is not an interaction, so the frame waits for
the next one. `await recorder.flush()` (from `@describe-me/vitest`) takes a
deferred frame after one settle, for a test that needs it earlier.

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
For jsdom, use `@describe-me/vitest/setup-dom`, import `render`, `fireEvent`
and `cleanup` from `@describe-me/react/testing-library`, and set `css: true`
and `env: { RTL_SKIP_AUTO_CLEANUP: 'true' }` yourself.

The reporter accepts the same `include` and `exclude`
(`new DescribeMeReporter({ exclude: '**/*.integration.test.tsx' })`) and
filters the manifest with them. Only the plugin hands them to the setup file,
so a hand-wired setup still records, and pays for, every test. The reporter
takes `previewHead` too, and nothing else needs it.

`renderFrame` also reaches the setup file only through the plugin. Without
it, call `recorder.configure({ renderFrame })` in a setup file of your own,
listed after describe-me's:

```ts
// describe-me-timing.ts
import { recorder } from '@describe-me/vitest'

recorder.configure({ renderFrame: 'lazy' })
```

```ts
setupFiles: ['@describe-me/vitest/setup-dom', './describe-me-timing.ts'],
```

## Open questions / next

- Controls: turn the props table into inputs and mount the component live
  (dev only, via a playground endpoint on the Vitest server).
- Live mount: re-run a test up to frame N inside the viewer with HMR.
- `adoptedStyleSheets` inside shadow roots are not mirrored yet.
- Vue / Svelte adapters: a `render` wrapper each, nothing else.

## Viewer

The sidebar lists files, `describe` blocks and tests in source order. The
middle shows the stage and the frame timeline. The inspector shows the test
status, the component and its props, and the current frame. The header shows
the test counts and the issues chip (see [Diagnostics](#diagnostics)). A click
on a file or a `describe` block opens its overview (see
[Component overview](#component-overview)).

```sh
describe-me dev   [--data .describe-me] [--port 6006]
describe-me build [--data .describe-me] [--out describe-me-dist] [--no-vendor-fonts]
```

| Flag                | Default              | Meaning                                                         |
| ------------------- | -------------------- | --------------------------------------------------------------- |
| `--data`            | `.describe-me`       | The directory the reporter wrote.                               |
| `--out`             | `describe-me-dist`   | `build` only: the output directory.                             |
| `--port`            | `6006`               | `dev` only: the port.                                           |
| `--no-vendor-fonts` | fonts are downloaded | `build` only: keep web fonts on their CDN, see [Fonts](#fonts). |

- **Search.** The field at the top of the sidebar. Each word must occur in the
  test's name with its suites, its file path or its component name,
  case-insensitive. Different words may match different fields. A search
  shows matches inside collapsed suites too. `/` focuses the field, Esc clears
  it, Enter or ↓ opens the first match.
- **Collapsing.** The arrow in front of a file or `describe` row collapses it.
  The browser remembers it per project in local storage. Opening a test
  expands the suites around it.
- **Keyboard.** ←/→ go to the previous or next frame. ↑/↓ go to the previous
  or next test the sidebar shows, so they follow the search and the collapsed
  suites. From a test hidden in a collapsed suite, ↑/↓ go to the nearest row
  the sidebar shows. In an overview, ↓ opens its first test and ↑ its last.
  `/` focuses the search. Shortcuts are off while you type in a field.
- **Viewport size.** Presets `100%`, `768px` and `375px`, and W and H fields
  in CSS pixels, whole numbers up to 10000. W runs from 1 and H from 120. A
  smaller H is raised to 120. An empty field means auto. An auto width fills
  the stage. An auto height fits the content and is measured again once web
  fonts load. Content sized to the viewport, like a full-height layout or a
  dialog on a backdrop, gets the stage's height. A dialog taller than the
  stage gets room for all of it. A viewport wider than the stage is scaled
  down, and the toolbar shows the zoom.
- **Links.** The address holds the view: `#test=<id>&frame=<n>&w=<px>&h=<px>`,
  or `suite=…` for an overview. `frame` counts from 0, so `frame=2` is the
  inspector's "frame 3". Copy the address to share a frame at a size. Back and
  Forward move between the tests and overviews you opened. Stepping through
  frames or through tests with ↑/↓ and changing the size add no history
  entries.

A test id stays the same on other machines and when other tests are added,
removed or reordered. Renaming a test or moving it to another suite or file
changes it. A link written by 0.4 still opens its test, and the viewer
rewrites it.

## Component overview

Click a `describe` block or a test file in the sidebar to get the component
page: its props read from TypeScript, which values the tests actually cover,
and the final frame of every test as a thumbnail.

```
variant   'primary' | 'secondary' | 'ghost' | 'danger'   primary ✓ (default)  secondary ✓  ghost ✓  danger ✗
size      'sm' | 'md' | 'lg'                             sm ✓  md ✓ (default)  lg ✓
loading   boolean                                        true ✓  false ✓ (default)
children  ReactNode                                      passed in 8 of 8 tests
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

When the element passed to `render` is not a registered export (a provider, a
fragment, `Suspense`, a host element or a component defined in the test file),
the test is documented under the first registered component inside it.
describe-me looks through the element's children and other element props
first, then through the tree React mounted, and skips `Suspense` fallbacks.
The props shown in the inspector and counted for coverage are the ones that
component received. With a `wrapper`, only the tree under your element is
searched, so the wrapper's own components are never picked. A registered root
keeps its own name.

A wrapper that ignores `children`, for example one that renders a router,
never mounts the element you pass. Name the test yourself after `render`.
`setComponent` replaces an `Anonymous` name, or a name without a `file` when
yours has one.

```tsx
import { recorder } from '@describe-me/vitest'

render(<></>, { wrapper: AppProviders })
recorder.setComponent({
  name: 'OrdersPage',
  file: 'src/pages/OrdersPage.tsx',
  props: { status: 'open' },
})
```

`name` must be the name of the export in `file`, and `file` is relative to the
Vitest root. With `file`, the props table works even when the test does not
import the component. The render frame does not change. It keeps its
`<Anonymous />` label and its props, `{}` here, so the props you pass do not
count toward coverage. The inspector shows them on the later frames, which
carry no props of their own.

The limits of naming, and what to do about them:

- A wrapper that ignores `children`: call `setComponent` with `file`, as above.
- A project component used as the root element, such as the app's exported
  provider, keeps its own name. Pass it as `wrapper` instead.
- An unexported provider written inline, `render(<Providers>{ui}</Providers>)`,
  around a `ui` defined in the test can name the test after a component the
  provider renders itself, such as a `GlobalStyles`. Pass it as `wrapper`
  instead.
- `setComponent` never replaces a name that already has a `file`.

The reporter reads the props type of that export with TypeScript: name, type,
required, default value from the destructuring pattern (also through
`forwardRef(…)` and `memo(…)`), JSDoc description. When the export was not
registered, it finds the file by following the test's import instead. Props
inherited from library types (`ButtonHTMLAttributes`) are left out. The whole
step costs about 0.1–0.2 s per run on the example.

## Diagnostics

After each run the reporter first prints one line per setup warning: a
problem the plugin found in the project's setup that can make tests fail, such
as a tslib that the browser build of styled-components cannot load (see
[Global styles](#global-styles-and-fonts)). Then it prints one warning line
for each thing it could not document: tests that render an anonymous component
(see the naming rules in [Component overview](#component-overview)),
components without props docs, assets that were not found, font families that
nothing loads, and remote hosts that frames load stylesheets from. The viewer
shows the same list behind an "issues" chip in its header, with the setup
warnings in a section of their own and links to the tests.
`pnpm check-manifest` fails on any of them in this repository's examples.

A few warnings are printed once, when their cause shows up:

- **Concurrent tests are not recorded**, once per test file that has them.
- **`previewHead` contains a `<script>`.** The viewer never runs it.
- **`test.css` is `false`.** Imported stylesheets are stubbed and missing from
  the snapshots.
- **TypeScript is not installed.** No component gets a props table.
- **Two components have the same name.** Only the first is documented.

`describe-me build` prints which font stylesheets it downloaded, which hosts it
left remote and which URLs did not download (see [Fonts](#fonts)).

## Styling techniques

A snapshot is DOM plus stylesheets, so how styles reach the page matters.
Verified by `StyledText.test.tsx` in both examples: the browser-mode replay is
checked for computed colours, and `pnpm check-styles` in `examples/react-jsdom`
checks that each rule is in the jsdom snapshots:

| Technique                                  | Used by                                                                                          | Browser mode                                                 | jsdom                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style={{ … }}` attributes                 | everyone                                                                                         | yes                                                          | yes                                                                                                                                                                                                            |
| `<style>` in the document                  | CSS imports, CSS modules, Tailwind, vanilla-extract, dev builds of emotion and styled-components | yes                                                          | yes, CSS imports need `test.css` (plugin sets it)                                                                                                                                                              |
| `<link rel="stylesheet">`                  | stylesheets and web fonts that a setup file or a library links                                   | same-origin sheets are inlined, cross-origin ones stay links | the link never loads during the test. Project files are copied with their `url()` targets. Remote URLs load from the network, except font stylesheets that `describe-me build` downloads (see [Fonts](#fonts)) |
| CSSOM `insertRule` into an empty `<style>` | emotion and styled-components in production ("speedy") mode                                      | yes, rrweb reads `cssRules`                                  | yes, simple rules verified                                                                                                                                                                                     |
| `document.adoptedStyleSheets`              | Lit and other web components                                                                     | yes, mirrored into a temporary `<style>` during capture      | no: jsdom has no constructable stylesheets                                                                                                                                                                     |
| `adoptedStyleSheets` on a shadow root      | web components with shadow DOM                                                                   | not yet                                                      | no                                                                                                                                                                                                             |

In jsdom, rules go through jsdom's own CSS parser, which drops what it does
not understand. Simple rules are verified; nesting, `@layer` and `@container`
are not yet.

## Global styles and fonts

The viewer shows the DOM and the CSS that were on the page during the test,
plus your `previewHead` (see [Fonts](#fonts)). A reset or a
`body { font-family }` that your app or Storybook adds around every component
must therefore be there in the test too, or buttons show up with the browser's
grey default and text in Times. Put them in the wrapper of your custom
`render`, the same place as your providers:

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

**styled-components in jsdom.** Vitest loads the Node build of
styled-components (5 and 6), whose `createGlobalStyle` never inserts its CSS
on the client, so `<GlobalStyles />` silently does nothing in jsdom. The plugin
therefore points `styled-components` at its browser build and pre-bundles it
together with `jest-styled-components`, so both share one instance and
`toMatchSnapshot` output stays the same. Versions 6.0 to 6.3 import tslib, and
the optimizer of Vite 6 and 7 bundles tslib's UMD file without its default
export, so every test that imports styled-components would fail with
`Cannot destructure property '__extends'`. The plugin points `tslib` at the
`tslib.es6.mjs` of the tslib that styled-components resolves, so you need no
`tslib` alias of your own. tslib before 2.5.3 has no such file, and
styled-components 6.1.3 to 6.1.9 pin 2.5.0. Then the plugin leaves tslib alone
and warns after the run (see [Diagnostics](#diagnostics)): upgrade
styled-components to 6.1.10 or later, or override tslib to 2.5.3 or later.
Turn all of this off with `describeMe({ styledComponentsBrowserBuild: false })`.

### Fonts

Fonts usually go missing because the app shell loads them, and tests never run
the shell: a Google Fonts `<link>` in `index.html`, a font loader called at
startup, or a `fonts.css` that only the app entry imports. Give the viewer the
same links with `previewHead`, like Storybook's `preview-head.html`:

```ts
describeMe({
  previewHead: `
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap">
    <link rel="stylesheet" href="/src/fonts.css">
  `,
})
```

A project that already has a `preview-head.html` can pass it as it is:

```ts
import { readFileSync } from 'node:fs'

describeMe({ previewHead: readFileSync('.storybook/preview-head.html', 'utf8') })
```

The head is stored once, in the manifest, and never reaches the test page. The
viewer adds it to the start of every frame's `<head>`, so the captured styles
win ties, and fits the frame again once the web fonts have loaded, waiting at
most 3 seconds. A note under the frame names the fonts and stylesheets that did
not load in the viewer. Local files that the head links with `href` or `src`,
and the `url()`s in its `<style>` blocks, are copied into `assets/`. A relative
path counts from the project root. `/src/fonts.css` above is copied together
with the fonts it points at.

An app shell that loads local fonts, say `src/app-shell/fonts.css` with
`@font-face` rules that point at `.ttf` files, has two ways in. The first is
the preview head:

```ts
describeMe({ previewHead: '<link rel="stylesheet" href="/src/app-shell/fonts.css">' })
```

The CSS is stored once, outside the snapshots, and copied with its `.ttf`
files. It must be plain CSS, see the list below.

The second is a setup file that only the describe-me run loads. This config
assumes the regular `vitest.config.ts` has no `describeMe()`:

```ts
// vitest.describe-me.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import { describeMe } from '@describe-me/vitest/plugin'
import config from './vitest.config'

export default mergeConfig(
  config,
  defineConfig({
    plugins: [describeMe()],
    test: { setupFiles: ['./describe-me.setup.ts'] },
  }),
)
```

```ts
// describe-me.setup.ts
import './src/app-shell/fonts.css'
```

Run it with `vitest run --config vitest.describe-me.config.ts`, and the regular
run stays as it is. The CSS goes through Vite, so aliases and PostCSS work. It
lands in the styles of every snapshot, its fonts are copied into `assets/`, and
the font check counts the family as loaded. The same import in an existing
setup file works too, in every run.

Do not call the app's font loaders in tests. The `<link>` a loader adds lands
in every snapshot, and in jsdom, where it never loads, every capture sets a
timer for it.

Keep in mind:

- The viewer ignores scripts in the head. The reporter warns about a
  `<script>`.
- Fonts never load inside jsdom, so the test itself never sees them. Only the
  viewer shows them.
- CSS linked from the head is copied as it is on disk. It skips PostCSS,
  Tailwind and every other Vite transform, so link plain CSS.
- `describe-me dev` loads remote fonts from the network. `describe-me build`
  downloads those from Google Fonts, Bunny Fonts and Fontsource on jsDelivr
  into the site.

`describe-me build` scans the preview head, the snapshots, the style chunks and
the CSS assets, so a link that an app's font loader added and data written by
0.4 are covered too. Adobe Fonts and fonts on other hosts stay remote, and the
build lists them. A stylesheet is replaced only when all its files downloaded.
Downloads are cached in `node_modules/.cache/describe-me/fonts`. Fonts are kept
for good and CSS for 7 days. Every `unicode-range` subset is downloaded, so the
site grows: Inter in three weights adds about 220 kB.

This needs the network. By default `describe-me build` connects to Google
Fonts, Bunny Fonts and jsDelivr when the data loads fonts from them and the
cache has no fresh copy. After one online build, the cache lets later builds
run offline. An unreachable host costs up to about 10 s once, then it is
skipped, and the build never fails because of it. `--no-vendor-fonts` keeps
the build off the network, for CI without network access or with privacy rules.

The reporter warns about font families that the captured CSS uses but nothing
loads. It reads the first family of each `font-family` and `font` declaration
and follows `var()`. Generic and system families are ignored. A family counts
as loaded when an `@font-face` rule or a stylesheet from Google Fonts, Bunny
Fonts or Fontsource on jsDelivr loads it, in the frame or in the preview head.
A stylesheet from any other host, such as Adobe Fonts or a custom CDN, turns
the check off for that frame, or for every frame when the head links it. A
family installed only on your machine still counts as missing. The reporter
also lists the hosts that frames load stylesheets from.

## Assets

Images, videos, local fonts and CSS `url()`s that point at project files are
copied into `.describe-me/assets/` when the snapshots are written, so they load
in `describe-me dev` and in the static build. rrweb records them as absolute
URLs on the test page (`http://localhost:3000/src/logo.svg` in jsdom, the Vitest
server in browser mode), which stop working once the tests end. A file is
looked up under the project root, then `public/`; paths that cannot be found
are listed as `assetsMissing` in the manifest and in the diagnostics. Links to
pages (`<a href="/">`) are left alone.

A CSS file keeps working when it is copied, because its `url()` and `@import`
targets are copied with it and the copy points at them. Only fonts, images,
cursors and CSS files are pulled in this way, so a stylesheet cannot publish a
source file or a secret. The local files of the [preview head](#fonts) are
copied as well.

## Output directory

The reporter writes everything the viewer shows into `.describe-me/` (the
plugin's `outDir` option):

- `manifest.json`: modules, tests, frames, component docs, diagnostics and the
  preview head.
- `snapshots/<hash>.json`: the serialized DOM of each frame.
- `styles/<hash>.css`: the snapshots' stylesheets, in chunks.
- `assets/<hash>.<ext>`: project files that snapshots, stylesheets and the
  preview head point at.

Every file but the manifest is named after a hash of its content, so identical
DOM is stored once, however many frames, tests and runs produce it. A
stylesheet of 256 characters or more moves out of the snapshot, which keeps a
reference (`describe-me-style:<hash>+<hash>…`). The sheet is split between
top-level rules into chunks of about 4 KB, and the rules decide where a chunk
ends. A large styled-components sheet that grows from test to test therefore
shares most of its chunks, and each rule is stored about once. Shorter sheets
stay inline.

After every test run, garbage collection deletes the snapshots no frame points
at, then the style chunks no kept snapshot refers to, then the assets that no
kept snapshot or chunk, nor the preview head, refers to. What a kept CSS asset
refers to is kept as well. A font or image used only from CSS is therefore
kept. Folders inside `snapshots/`, `styles/` and `assets/` are left alone.
`describe-me build` copies the directory into the static site as
`__data/`, then downloads web fonts into the copy. The `.describe-me` directory
itself never changes.

The viewer reads output written by 0.4. A 0.4 viewer cannot read this output
(frames show without their stylesheets), so upgrade `describe-me` together with
`@describe-me/vitest`.

`manifest.json` names the package and version that wrote it in `generator`.
The viewer shows a banner under its header when that major.minor differs from
its own. A test run where two incompatible copies of `@describe-me/core` meet
fails every test file with "all describe-me packages must be on the same
version".

## Switches

There is no `.env`: nothing here is per-environment configuration or a secret.
The variables below are one-shot switches for the examples' benchmarks, set
inline for a single run. All three work in both examples.

| Variable           | Effect                                                       |
| ------------------ | ------------------------------------------------------------ |
| `DESCRIBE_ME=off`  | Same tests, recording disabled (baseline for `bench:macro`). |
| `BENCH_OUT=<file>` | Replace the console reporter with JSON per-test durations.   |
| `BENCH_MICRO=1`    | Run `bench/` instead of `src/` (capture cost by DOM size).   |

`DESCRIBE_ME_DIR` is set by the `describe-me` CLI for the viewer; use `--data`
instead of setting it yourself.

## Overhead

Each example suite runs with recording off (`DESCRIBE_ME=off`) and on, and the
figures below compare the two. `node ../../scripts/bench-macro.mjs 9`, run in
`examples/react-browser` and `examples/react-jsdom`, runs `vitest run` 9 times
per variant, off and on in turn, and reports medians. `pnpm bench:macro` does
the same with 5 runs. `pnpm bench:micro` in both examples measures single
captures. Measured on an Apple M2 with Node 20.19.5.

### Example suites

Browser mode, `examples/react-browser` in headless Chromium: 25 tests, 44
frames.

|                            | recording off | recording on | overhead        |
| -------------------------- | ------------- | ------------ | --------------- |
| sum of test durations      | 1421 ms       | 1635 ms      | +214 ms (+15 %) |
| wall clock of `vitest run` | 2599 ms       | 3438 ms      | +838 ms (+32 %) |

jsdom, `examples/react-jsdom`: 28 tests, 23 of them in the manifest, 33
frames.

|                            | recording off | recording on | overhead         |
| -------------------------- | ------------- | ------------ | ---------------- |
| sum of test durations      | 620 ms        | 1022 ms      | +401 ms (+65 %)  |
| wall clock of `vitest run` | 2013 ms       | 3091 ms      | +1078 ms (+54 %) |

The wall clock also covers the reporter: component docs, snapshot files,
stylesheets and assets.

### Capture cost

Per `step()` capture, by DOM size (median): 48 nodes 0.4 ms · 318 nodes 1.3 ms ·
3 018 nodes 10.7 ms · 15 018 nodes 57.4 ms in Chromium. 35 nodes 1.8 ms · 305
nodes 3.7 ms · 3 005 nodes 26.6 ms · 15 005 nodes 136.8 ms in jsdom, where the
1 ms `setTimeout(0)` of the settle is part of every capture. Most of it is
rrweb's serialization. `JSON.stringify` of the result takes 13–14 % of a
capture from 3 000 nodes up in Chromium and 7–8 % in jsdom. Comparing that text
with the previous frame's takes at most 0.3 ms in Chromium and 0.52 ms in jsdom,
at 15 000 nodes.

Naming a test after the first registered component inside a provider takes
0.14 ms at 3 008 nodes in jsdom (median).

`pnpm measure-output` finds 37 snapshot files for 37 distinct DOMs and a
`styles/` of 4 files, 3.7 kB, in `examples/react-browser`, and 26 snapshot
files for 26 distinct DOMs and a `styles/` of 9 files, 4.2 kB, in
`examples/react-jsdom`.

The first version waited for `requestAnimationFrame` before every capture,
which cost a full vsync (~16 ms) per frame and made tests 1.8× slower.
A snapshot is DOM + stylesheets, not layout, so a single macrotask is enough
for React to commit; the rAF was removed.
