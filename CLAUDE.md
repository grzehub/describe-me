# describe-me — notes for AI assistants

Living component documentation generated from Vitest browser-mode tests.
Read `README.md` for the architecture and `STYLE.md` for how code is written
here. Follow STYLE.md even when it makes the code longer; the humans on this
project asked for light and visible structure.

## Commands

```sh
pnpm install
pnpm build            # tsc for core, react, vitest
pnpm lint:fix         # eslint --fix + prettier --write (run before finishing)
pnpm lint && pnpm format:check
cd examples/react-basic && pnpm test          # 12 tests, browser mode
cd examples/react-basic && pnpm bench:micro   # capture cost by DOM size
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
