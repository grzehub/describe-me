# @describe-me/core

**Your tests are your stories.** The recorder and the manifest types of
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

| Package               | What it is                                  | Install it              |
| --------------------- | ------------------------------------------- | ----------------------- |
| `describe-me`         | the viewer and the `describe-me` CLI        | yes                     |
| `@describe-me/vitest` | the Vitest plugin, setup files and reporter | yes                     |
| `@describe-me/react`  | `render` functions that record frames       | yes                     |
| `@describe-me/core`   | the recorder and the manifest types (this)  | no, the others bring it |

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

The framework-agnostic heart of describe-me. Snapshots are serialized DOM via
`rrweb-snapshot`, so nothing here knows about React. You need it directly only
to write an adapter for another framework or to read the output yourself.

| Entry point                                                                                                    | What it holds                                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`@describe-me/core`](https://grzehub.github.io/describe-me/api.html#entry-core)                               | `step()`, `recorder` and `elementLabel()`, for adapters |
| [`@describe-me/core/types`](https://grzehub.github.io/describe-me/api.html#entry-core-types)                   | the types of `.describe-me/manifest.json`               |
| [`@describe-me/core/diagnostics`](https://grzehub.github.io/describe-me/api.html#entry-core-diagnostics)       | what a manifest could not document                      |
| [`@describe-me/core/css-references`](https://grzehub.github.io/describe-me/api.html#entry-core-css-references) | the `url()` and `@import` references in CSS text        |

[How it works](https://grzehub.github.io/describe-me/how-it-works.html) explains
the recorder and the output directory.

## License

MIT
