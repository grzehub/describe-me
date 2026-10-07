# @describe-me/react

**Your tests are your stories.** The React adapter of describe-me: living
component documentation generated from the Vitest tests you already have.

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

| Package               | What it is                                   | Install it              |
| --------------------- | -------------------------------------------- | ----------------------- |
| `describe-me`         | the viewer and the `describe-me` CLI         | yes                     |
| `@describe-me/vitest` | the Vitest plugin, setup files and reporter  | yes                     |
| `@describe-me/react`  | `render` functions that record frames (this) | yes                     |
| `@describe-me/core`   | the recorder and the manifest types          | no, the others bring it |

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

Drop-in `render` functions that record a frame after mount and after every
`rerender`, and read the component's name and props for the docs. It is the
only React-specific code in describe-me.

| Entry point                                                                                                        | Wraps                    | For                 |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------- |
| [`@describe-me/react`](https://grzehub.github.io/describe-me/api.html#entry-react)                                 | `vitest-browser-react`   | Vitest browser mode |
| [`@describe-me/react/testing-library`](https://grzehub.github.io/describe-me/api.html#entry-react-testing-library) | `@testing-library/react` | jsdom               |

Each entry point re-exports its test library with the recording functions
swapped in. With the `describeMe()` plugin you never import them yourself: it
redirects your `render` imports, those in your own `test-utils` included.
Install the test library your tests use. Both are optional peers.

## License

MIT
