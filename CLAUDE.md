# describe-me — notes for AI assistants

Living component documentation generated from Vitest browser-mode tests.
Read `README.md` for the architecture and `STYLE.md` for how code is written
here. Follow STYLE.md even when it makes the code longer; the humans on this
project asked for light and visible structure.

The published packages are `@describe-me/core`, `@describe-me/react`,
`@describe-me/vitest` and `describe-me` — the last one is the CLI and viewer,
which lives in `packages/viewer`.

## Commands

```sh
pnpm install
pnpm build            # tsc for core, react, vitest and the viewer CLI
pnpm lint:fix         # eslint --fix + prettier --write (run before finishing)
pnpm lint && pnpm format:check
cd examples/react-basic && pnpm test          # 16 tests, browser mode
cd examples/react-basic && pnpm bench:micro   # capture cost by DOM size
cd examples/react-basic && pnpm docs:build    # static site → docs-dist/
```

## Rules of the road

- One exported function or class per file. Barrel `index.ts` only re-exports.
- Do not change a package's public exports without saying so explicitly.
- The core and viewer packages must stay free of React imports. React lives
  only in `packages/react`.
- Snapshots are DOM + stylesheets via rrweb-snapshot; do not add layout or
  screenshot capture to the hot path without measuring (`bench:micro`).
- Verify with build + tests + lint + format before reporting done.
- Do not commit or push unless asked.
