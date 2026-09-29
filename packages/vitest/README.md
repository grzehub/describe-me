# @describe-me/vitest

The Vitest integration for [describe-me](https://github.com/grzehub/describe-me):
a plugin, a setup file that makes every interaction record a frame, and the Node
reporter that writes `.describe-me/`.

## Install

```sh
pnpm add -D @describe-me/vitest @describe-me/react describe-me
```

## Usage

One line in the Vitest config registers the setup file and the reporter, and
redirects the test library's `render` import to the recording adapter. The
plugin detects where the tests run:

- **Browser mode** (`test.browser.enabled`): redirects `vitest-browser-react`,
  records a frame after every `Locator` action and keyboard-level `userEvent`.
- **DOM environments** such as jsdom (anything else): redirects
  `@testing-library/react`, records a frame after every `fireEvent` and every
  `@testing-library/user-event` call, turns on `test.css` so imported
  stylesheets reach the snapshots, and sets `RTL_SKIP_AUTO_CLEANUP` so the
  component is unmounted only after the closing frame. The setup file sets
  React's `IS_REACT_ACT_ENVIRONMENT` where Testing Library would, so act
  warnings match a run without describe-me. It also works without user-event
  installed.

jsdom has no layout, so positioned popovers show in the top-left corner and
canvas stays blank
([Limitations in jsdom](https://github.com/grzehub/describe-me#limitations-in-jsdom)).

```ts
import { describeMe } from '@describe-me/vitest/plugin'

// browser mode
export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
})

// jsdom
export default defineConfig({
  plugins: [react(), describeMe()],
  test: { environment: 'jsdom' },
})
```

Pass `describeMe({ environment: 'browser' | 'dom' })` to override the detection.

A test that records no frame before the closing one (no recording `render`,
no interaction, no `step()`) costs no snapshot and is left out of the
manifest. `describeMe({ include, exclude })` chooses which test files are
recorded, with picomatch globs relative to the Vitest root. `exclude` wins.
Tests in other files still run, but record nothing. The reporter takes the
same two options, but on its own it only filters the manifest: without the
plugin the setup file does not know them.

`describeMe({ previewHead })` takes HTML that the viewer adds to the start of
every frame's `<head>`, like Storybook's `preview-head.html`: typically the
font links that the app shell loads and tests never do. It never reaches the
test page, and the local files it links are copied into the output directory
([Fonts](https://github.com/grzehub/describe-me#fonts) in the root README).

`describeMe({ renderFrame })` chooses when the render frame is taken:
`'eager'` (default) right after mount, `'lazy'` right before the next
interaction, or `{ pending: '<selector>' }` once a loader is gone. See
[Render frame timing](https://github.com/grzehub/describe-me#render-frame-timing).

The pieces can also be wired by hand. Tests then import from the adapter
themselves: `render` from `@describe-me/react` in browser mode, and `render`,
`fireEvent` and `cleanup` from `@describe-me/react/testing-library` in jsdom:

```ts
import DescribeMeReporter from '@describe-me/vitest/reporter'

export default defineConfig({
  test: {
    // browser mode: '@describe-me/vitest/setup'
    setupFiles: ['@describe-me/vitest/setup-dom'],
    reporters: ['default', new DescribeMeReporter()],
    // jsdom only: keep imported CSS and leave unmounting to describe-me
    css: true,
    env: { RTL_SKIP_AUTO_CLEANUP: 'true' },
  },
})
```

`typescript` is an optional peer: without it the docs are still generated, only
the props tables are left out. `@testing-library/user-event` is an optional
peer too, needed only in DOM environments.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
