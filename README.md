# describe-me

**Your tests are your stories.** Living component documentation generated
from the unit tests you already have. No separate story abstraction.

describe-me captures the DOM after each step of a test and shows the result
as a browsable catalog: `describe` blocks become the sidebar, each `it` is a
story, each step is a frame you can scrub through. Stories cannot rot,
because they are tests. If one drifts from the component, CI goes red.

https://github.com/user-attachments/assets/edc2d289-5d0a-444d-9d9f-6f0d3dd1342f

**[Read the docs](https://grzehub.github.io/describe-me/)** · see the viewers
of the [browser-mode example](https://grzehub.github.io/describe-me/examples/react-browser/),
the [jsdom example](https://grzehub.github.io/describe-me/examples/react-jsdom/),
the [shadcn/ui example](https://grzehub.github.io/describe-me/examples/shadcn/)
and the [Material UI example](https://grzehub.github.io/describe-me/examples/mui/),
or **[open the starter in StackBlitz](https://stackblitz.com/github/grzehub/describe-me/tree/main/examples/stackblitz)**:
three components, their tests and the viewer in jsdom, nothing to clone.

## Status

Early. React, Vitest in browser mode or jsdom. The viewer replays the
recorded frames and can mount a test in
[Live](https://grzehub.github.io/describe-me/viewer.html#live), from its
arrange phase. There are no controls yet.
[Foundations](https://grzehub.github.io/describe-me/foundations.html) shows
the tokens of your design system, read from the CSS the tests load and an
optional theme module.
[Limitations](https://grzehub.github.io/describe-me/limitations.html) lists
every known limit and whether a fix is planned.

https://github.com/user-attachments/assets/36d95ba1-3e99-4f63-9d1f-b87fce79653e

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
describe-me dev                  # the viewer, repainted while vitest --watch runs
describe-me build --out docs     # a static site: the viewer and its data
```

`describe-me build --live` adds
[Live](https://grzehub.github.io/describe-me/viewer.html#flag-live) to the
site.

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
- [Examples](https://grzehub.github.io/describe-me/examples.html): the four
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
  frames, `step()`, component names, props and what Live runs.
- [Styles and fonts](https://grzehub.github.io/describe-me/styles-and-fonts.html):
  global styles, web fonts and assets.
- [Foundations](https://grzehub.github.io/describe-me/foundations.html): the
  tokens of your design system, from what the tests load.
- [Viewer and CLI](https://grzehub.github.io/describe-me/viewer.html):
  `describe-me dev` and `build`, Live, and what the viewer does.
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
