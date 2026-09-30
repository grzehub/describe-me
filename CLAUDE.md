# describe-me — notes for AI assistants

Living component documentation generated from Vitest tests, in browser mode
or jsdom.
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
pnpm --filter describe-me typecheck   # viewer sources, after pnpm build
pnpm lint:fix         # eslint --fix + prettier --write (run before finishing)
pnpm lint && pnpm format:check
cd examples/react-browser && pnpm test          # 25 tests, browser mode
cd examples/react-jsdom && pnpm test          # 28 tests, jsdom (23 in the manifest)
cd examples/react-jsdom && pnpm check-styles  # which CSS survives a jsdom snapshot
pnpm check-manifest   # both examples' manifests, after running their tests
pnpm check-style-store   # stylesheet chunking and GC, after pnpm build
pnpm check-asset-store   # CSS references, copied CSS, preview head and asset GC, after pnpm build
pnpm check-font-audit   # which font families count as missing, after pnpm build
pnpm check-vendor-fonts   # font vendoring in describe-me build, offline, after pnpm build
pnpm check-frame-timing   # frame compaction and renderFrame validation, after pnpm build
pnpm check-styled-components   # the tslib alias and setup warning for styled-components, after pnpm build
pnpm check-version-guard   # recorder protocol guard and manifest generator, after pnpm build
pnpm measure-output   # snapshot files vs distinct DOMs, CSS weight
cd examples/react-browser && pnpm bench:micro   # capture cost by DOM size
cd examples/react-jsdom && pnpm bench:micro     # the same in jsdom, plus the naming lookup
cd examples/react-browser && pnpm bench:macro   # wall clock with and without recording
cd examples/react-browser && pnpm docs:build    # static site → docs-dist/
pnpm smoke            # pack + install tarballs in a fresh project [--vite x.y.z] [--vitest x.y.z] [--react x.y.z] (Node ^20.19 || >=22.12)
```

## Rules of the road

- One exported function or class per file. Barrel `index.ts` only re-exports.
- Do not change a package's public exports without saying so explicitly.
- The core and viewer packages must stay free of React imports. React lives
  only in `packages/react`.
- The browser path never imports Testing Library and the DOM path never
  imports `vitest/browser`: they live behind separate entry points
  (`setup` / `setup-dom`, `@describe-me/react` / `./testing-library`).
- Snapshots are DOM + stylesheets via rrweb-snapshot; do not add layout or
  screenshot capture to the hot path without measuring (`bench:micro`).
- Verify with build + tests + lint + format before reporting done.
- Do not commit or push unless asked.
