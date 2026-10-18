# describe-me — notes for AI assistants

Living component documentation generated from Vitest tests, in browser mode
or jsdom.
Read `docs/how-it-works.html` for the architecture, `STYLE.md` for how code is
written here and `docs/README.md` for how to write docs pages.
Follow STYLE.md even when it makes the code longer; the humans on this
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
cd examples/shadcn && pnpm test   # 12 tests, browser mode, Tailwind 4 and shadcn/ui
cd examples/mui && pnpm test   # 6 tests, jsdom, Material UI
cd examples/mui && MUI_CSS_VARS=1 pnpm test   # the same tests with cssVariables: true, into node_modules/.describe-me-css-vars
pnpm check-manifest   # react-browser and react-jsdom in full with --require-fonts, shadcn and mui with --structure-only, after running every example's tests
pnpm check-style-store   # stylesheet chunking and GC, after pnpm build
pnpm check-asset-store   # CSS references, copied CSS, preview head, asset GC, and machine paths in snapshots, error texts and `assetsMissing`, after pnpm build
pnpm check-font-audit   # which font families count as missing, after pnpm build
pnpm check-vendor-fonts   # font vendoring in describe-me build, offline, after pnpm build
pnpm check-frame-timing   # frame compaction and renderFrame validation, after pnpm build
pnpm check-styled-components   # the tslib alias and setup warning for styled-components, after pnpm build
pnpm check-version-guard   # recorder protocol guard and manifest generator, after pnpm build
pnpm check-act-parity   # act warnings with and without recording in examples/react-jsdom, after pnpm build
pnpm check-projects   # inline test.projects record and unmount, and one with extends: false keeps Testing Library's cleanup, on examples/react-jsdom with PROJECTS=1, after pnpm build and the jsdom example's tests
pnpm check-stories   # stories: 'all' / 'tagged' and the docs / no-docs tags, on examples/react-jsdom/stories, after pnpm build
pnpm check-live   # every test of all four examples mounted in the live preview and in a static build served under a sub-path, Live in every example's viewer through describe-me dev, and the live fixtures of react-browser and react-jsdom under Vitest, in the live preview and in the static build, in Chromium, after pnpm build and every example's tests
pnpm measure-output   # snapshot files vs distinct DOMs, CSS weight
cd examples/react-browser && pnpm bench:micro   # capture cost by DOM size
cd examples/react-jsdom && pnpm bench:micro     # the same in jsdom, plus the naming lookup
cd examples/react-browser && pnpm bench:macro   # plugin and recording cost, interleaved variants
cd examples/react-jsdom && pnpm bench:macro     # the same in jsdom, plus the switched-off plugin parts
cd examples/react-browser && pnpm docs:build    # static site → docs-dist/
pnpm check-docs       # docs/ pages: skeleton, tokens, links, deep links, code samples, README links and the shape of the package READMEs, after every example's tests
pnpm site:build       # docs/ plus the four example viewers with Live → site/ [--no-vendor-fonts], after pnpm build and every example's tests
pnpm site:serve       # serve site/ at http://localhost:6060/ [--port n]
pnpm site             # site:build, then site:serve
pnpm check-site       # no file of the site names the checkout or the home directory, docs.css applies, every viewer loads, react-browser shows and filters by its tag forms and folds a long props table, an overview with several components paints every gallery in every viewer, Live mounts a test in every viewer and shows its loading state (the dimmed recorded frame until the first status, one slot after leaving Live or picking another test while it loads, and reduced motion), the stage background (bg sets the canvas and the frames' color scheme, in replay, in Live and in the overview), the sidebar's edge sets the width from the keyboard and by dragging, per project and kept after a reload, and the viewer theme (it survives a reload and leaves the frames alone), in Chromium, after pnpm site:build
pnpm docs:screenshots [page.html …]   # light and dark, 1280 and 390 px wide [--out dir]
pnpm docs:link react-browser "<full test name>" [frame]   # a deep link into an example viewer for a docs page
pnpm smoke            # pack + install tarballs in a fresh project [--vite x.y.z] [--vitest x.y.z] [--react x.y.z] (Node ^20.19 || >=22.12)
```

## Rules of the road

- One exported function or class per file. Barrel `index.ts` only re-exports.
- Do not change a package's public exports without saying so explicitly.
- The core and viewer packages must stay free of React imports. React lives
  only in `packages/react`.
- The browser path never imports Testing Library and the DOM path never
  imports `vitest/browser`: they live behind separate entry points
  (`setup` / `setup-dom`, `@describe-me/react` / `./testing-library`,
  `@describe-me/react/live` / `./live-testing-library`).
- The plugin's per-environment logic (render redirect, setup file, config)
  lives in `packages/vitest/src/browser-profile.ts` and `dom-profile.ts`.
  `plugin.ts` imports only the chosen one, so browser mode never loads the
  DOM code.
- Live mode (`DESCRIBE_ME_LIVE=1`, set only by `createLiveServer()` and
  `buildLive()` while they load the config) lives in
  `packages/vitest/src/*live*.ts`, and a test run never takes that path.
- The CLI reaches `@describe-me/vitest/live` only through the project's root,
  and `describe-me` never depends on `@describe-me/vitest`.
- Snapshots are DOM + stylesheets via rrweb-snapshot; do not add layout or
  screenshot capture to the hot path without measuring (`bench:micro`).
- A change in behaviour updates its docs page in the same PR.
- Verify with build + tests + lint + format + `pnpm check-docs` before reporting done.
- Do not commit or push unless asked.
