# describe-me

The viewer and CLI of [describe-me](https://github.com/grzehub/describe-me):
living component documentation generated from the Vitest tests you already have.
`describe` blocks become the sidebar, each `it` is a story, each step is a frame
you can scrub through.

It reads the `.describe-me/` directory that `@describe-me/vitest`'s reporter
writes, and replays the snapshots in a sandboxed iframe.

## Install

```sh
pnpm add -D describe-me @describe-me/vitest @describe-me/react
```

`vite` is a peer dependency (Vitest requires it anyway): pnpm and npm install
it automatically; with yarn, add `vite` to your `devDependencies`.

All describe-me packages must be on the same version
([Add it to your project](https://github.com/grzehub/describe-me#add-it-to-your-project)).

## Usage

```sh
describe-me dev                  # viewer on http://localhost:6006, live while vitest --watch runs
describe-me build --out docs     # self-contained static site: viewer + __data/
```

| Flag                | Default              | Meaning                               |
| ------------------- | -------------------- | ------------------------------------- |
| `--data`            | `.describe-me`       | The directory the reporter wrote.     |
| `--out`             | `describe-me-dist`   | Output directory for `build`.         |
| `--port`            | `6006`               | Port for `dev`.                       |
| `--no-vendor-fonts` | fonts are downloaded | `build`: keep web fonts on their CDN. |

The viewer has search, collapsible suites, keyboard navigation, custom
viewport sizes and shareable links
([Viewer](https://github.com/grzehub/describe-me#viewer)).

`build` downloads the web fonts that the preview head and the snapshots load
from Google Fonts, Bunny Fonts and Fontsource on jsDelivr into the site, so
the docs show them offline. Adobe Fonts stay remote, because their license
does not allow self-hosting, and so do fonts on any other host. The build
lists both.

This needs the network. By default `build` connects to Google Fonts, Bunny
Fonts and jsDelivr when the data loads fonts from them and the cache has no
fresh copy. Downloads are cached in `node_modules/.cache/describe-me/fonts`,
so after one online build later builds run offline. An unreachable host costs
up to about 10 s once, then it is skipped. A font that does not download keeps
loading from the network, and the build never fails because of it.
`--no-vendor-fonts` keeps the build off the network, for CI without network
access or with privacy rules.

The static site uses relative URLs, so it works from a sub-path such as
GitHub Pages.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
