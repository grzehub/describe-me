# describe-me

**Your tests are your stories.** The viewer and the `describe-me` CLI of
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
| `describe-me`         | the viewer and the `describe-me` CLI (this) | yes                     |
| `@describe-me/vitest` | the Vitest plugin, setup files and reporter | yes                     |
| `@describe-me/react`  | `render` functions that record frames       | yes                     |
| `@describe-me/core`   | the recorder and the manifest types         | no, the others bring it |

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

```sh
describe-me dev                  # the viewer, live while vitest --watch runs
describe-me build --out docs     # a static site: the viewer and its data
```

`build` writes a site with relative URLs, so it works under a sub-path such as
GitHub Pages. It needs a web server and does not open from disk. It also
downloads web fonts from Google Fonts, Bunny Fonts and Fontsource into the
site, so it shows them offline.
[Viewer and CLI](https://grzehub.github.io/describe-me/viewer.html) lists every
flag and what the viewer can do.

`vite` is a peer dependency, which pnpm and npm install on their own. With
yarn, add it to your `devDependencies`.

## License

MIT
