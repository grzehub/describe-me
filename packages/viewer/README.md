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

## Usage

```sh
describe-me dev                  # viewer on http://localhost:6006, live while vitest --watch runs
describe-me build --out docs     # self-contained static site: viewer + __data/
```

| Flag     | Default            | Meaning                           |
| -------- | ------------------ | --------------------------------- |
| `--data` | `.describe-me`     | The directory the reporter wrote. |
| `--out`  | `describe-me-dist` | Output directory for `build`.     |
| `--port` | `6006`             | Port for `dev`.                   |

The static site uses relative URLs, so it works from a sub-path such as
GitHub Pages.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
