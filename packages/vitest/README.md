# @describe-me/vitest

**Your tests are your stories.** The Vitest plugin, setup files and reporter of
describe-me: living component documentation generated from the Vitest tests
you already have.

**[Read the docs](https://grzehub.github.io/describe-me/)** · open the viewer
of the [browser-mode example](https://grzehub.github.io/describe-me/examples/react-browser/)
or the [jsdom example](https://grzehub.github.io/describe-me/examples/react-jsdom/)
· [Limitations](https://grzehub.github.io/describe-me/limitations.html)

describe-me captures the DOM after each step of a test and shows the result as
a browsable catalog. `describe` blocks become the sidebar, each `it` is a
story, and each step is a frame you can scrub through. Stories cannot rot,
because they are tests. If one drifts from the component, CI goes red.

Status: prototype. React 18 and 19, Vitest 4 and 5 in browser mode or jsdom,
static snapshots.

## Which package do I need

| Package               | What it is                                         | Install it              |
| --------------------- | -------------------------------------------------- | ----------------------- |
| `describe-me`         | the viewer and the `describe-me` CLI               | yes                     |
| `@describe-me/vitest` | the Vitest plugin, setup files and reporter (this) | yes                     |
| `@describe-me/react`  | `render` functions that record frames              | yes                     |
| `@describe-me/core`   | the recorder and the manifest types                | no, the others bring it |

## Quick start

```sh
pnpm add -D describe-me @describe-me/vitest @describe-me/react
```

```ts
// vitest.config.ts
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe()],
  test: { environment: 'jsdom' }, // or your browser-mode settings
})
```

Run your tests, then `describe-me dev` opens the viewer.
[Getting started](https://grzehub.github.io/describe-me/getting-started.html)
walks through both environments. Keep all describe-me packages on one version
([why](https://grzehub.github.io/describe-me/installation.html#lockstep)).

## This package

The plugin is the whole integration. It detects browser mode or a DOM
environment, registers the setup file and the reporter, and redirects your
test library's `render` to the recording one, so existing tests record frames
unchanged.
[What the plugin changes](https://grzehub.github.io/describe-me/configuration.html#plugin)
lists every change it makes to your config, and
[Options](https://grzehub.github.io/describe-me/configuration.html#options)
every option it takes.

| Entry point                     | What it holds                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@describe-me/vitest/plugin`    | [`describeMe()`](https://grzehub.github.io/describe-me/api.html#entry-vitest-plugin)                  |
| `@describe-me/vitest`           | [`step()` and `recorder`](https://grzehub.github.io/describe-me/api.html#entry-vitest)                |
| `@describe-me/vitest/setup`     | [the browser-mode setup file](https://grzehub.github.io/describe-me/api.html#entry-vitest-setup)      |
| `@describe-me/vitest/setup-dom` | [the jsdom setup file](https://grzehub.github.io/describe-me/api.html#entry-vitest-setup-dom)         |
| `@describe-me/vitest/reporter`  | [the reporter, to wire by hand](https://grzehub.github.io/describe-me/api.html#entry-vitest-reporter) |

`typescript` and `@testing-library/user-event` are optional peers. Without
TypeScript the docs have no props tables. user-event is needed only when your
jsdom tests use it.

## License

MIT
