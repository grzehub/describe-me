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
  `@testing-library/react`, records a frame after every
  `@testing-library/user-event` call, turns on `test.css` so imported
  stylesheets reach the snapshots, and sets `RTL_SKIP_AUTO_CLEANUP` so the
  component is unmounted only after the closing frame.

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

The pieces can also be wired by hand, in which case tests import `render` from
the adapter themselves (`@describe-me/react` in browser mode,
`@describe-me/react/testing-library` in jsdom):

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
