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
redirects `vitest-browser-react` imports to the recording adapter:

```ts
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
})
```

The pieces can also be wired by hand, in which case tests import `render` from
`@describe-me/react` themselves:

```ts
import DescribeMeReporter from '@describe-me/vitest/reporter'

export default defineConfig({
  test: {
    setupFiles: ['@describe-me/vitest/setup'],
    reporters: ['default', new DescribeMeReporter()],
  },
})
```

`typescript` is an optional peer: without it the docs are still generated, only
the props tables are left out.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
