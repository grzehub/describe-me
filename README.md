# describe-me

**Your tests are your stories.** Living component documentation generated
from the unit tests you already have. No separate story abstraction.

describe-me captures the DOM after each step of a test and shows the result
as a browsable catalog: `describe` blocks become the sidebar, each `it` is a
story, each step is a frame you can scrub through. Stories cannot rot,
because they are tests. If one drifts from the component, CI goes red.

**[Read the docs](https://grzehub.github.io/describe-me/)** · see the viewer
of the [browser-mode example](https://grzehub.github.io/describe-me/examples/react-browser/)
and the [jsdom example](https://grzehub.github.io/describe-me/examples/react-jsdom/)

## Status

Prototype. React, Vitest in browser mode or jsdom, static snapshots (no live
mount). [Limitations](https://grzehub.github.io/describe-me/limitations.html)
lists every known limit and whether a fix is planned.

## Add it to your project

```sh
pnpm add -D describe-me @describe-me/vitest @describe-me/react
```

Keep all describe-me packages on one version, as
[One version for all packages](https://grzehub.github.io/describe-me/installation.html#lockstep)
explains.

Browser mode:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

jsdom:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe()],
  test: { environment: 'jsdom' },
})
```

Run your tests, then open the viewer or build it as a static site:

```sh
describe-me dev                  # the viewer, live while vitest --watch runs
describe-me build --out docs     # a static site: the viewer and its data
```

[Getting started](https://grzehub.github.io/describe-me/getting-started.html)
walks through both environments.
[Installation](https://grzehub.github.io/describe-me/installation.html) has
the supported versions and CI, and
[Configuration](https://grzehub.github.io/describe-me/configuration.html)
every option.

## Documentation

Start

- [Overview](https://grzehub.github.io/describe-me/): what describe-me does
  and what you get.
- [Getting started](https://grzehub.github.io/describe-me/getting-started.html):
  the first run, in browser mode and in jsdom.
- [Examples](https://grzehub.github.io/describe-me/examples.html): the two
  example projects and their viewers.
- [Why describe-me](https://grzehub.github.io/describe-me/why.html): tests as
  stories, compared with writing stories by hand.

Setup

- [Installation](https://grzehub.github.io/describe-me/installation.html):
  versions, package managers, monorepos and CI.
- [Configuration](https://grzehub.github.io/describe-me/configuration.html):
  the plugin, its options and the setup by hand.
- [Environments](https://grzehub.github.io/describe-me/environments.html):
  browser mode and jsdom, and what each can show.

Use

- [Writing stories](https://grzehub.github.io/describe-me/writing-stories.html):
  frames, `step()`, component names and props.
- [Styles and fonts](https://grzehub.github.io/describe-me/styles-and-fonts.html):
  global styles, web fonts and assets.
- [Viewer and CLI](https://grzehub.github.io/describe-me/viewer.html):
  `describe-me dev` and `build`, and what the viewer does.
- [Troubleshooting](https://grzehub.github.io/describe-me/troubleshooting.html):
  diagnostics, warnings and common symptoms.

Reference

- [API](https://grzehub.github.io/describe-me/api.html): every entry point and
  export.
- [How it works](https://grzehub.github.io/describe-me/how-it-works.html):
  recording, the output directory and the manifest.
- [Performance](https://grzehub.github.io/describe-me/performance.html): what
  recording costs, measured on the examples.
- [Limitations](https://grzehub.github.io/describe-me/limitations.html): every
  known limit and the roadmap.

## Contributing

```sh
pnpm install
pnpm build                                              # the four packages
pnpm --filter react-browser exec playwright install chromium
pnpm --filter react-browser test                        # browser mode
pnpm --filter react-jsdom test                          # jsdom
pnpm site                                               # docs and viewers at http://localhost:6060/
pnpm check-docs                                         # docs pages and README links
```

- [STYLE.md](STYLE.md): how code and prose are written here.
- [docs/README.md](docs/README.md): how to write a docs page.
- [RELEASING.md](RELEASING.md): how a release reaches npm.
- [CLAUDE.md](CLAUDE.md): every command and check, and the rules of the road.
