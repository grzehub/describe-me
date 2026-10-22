# describe-me

## 0.11.0

### Minor Changes

- [#116](https://github.com/grzehub/describe-me/pull/116) [`4985c9d`](https://github.com/grzehub/describe-me/commit/4985c9d91ac66c3f731e688b4de47f6aabcb0911) Thanks [@grzehub](https://github.com/grzehub)! - Foundations reads a typography part from a custom property's name wherever it sits: `font-family`, `font-weight`, `font-size`, `line-height` and `letter-spacing`, also in camelCase, in the plural or as one word. Each such row paints its sample, so `--font-size-lg`, `--chakra-font-sizes-md`, `--line-height-tight` and `--letter-spacing-wide` show a line at that size, leading or tracking. The part wins over the Tailwind prefixes, so `--font-size-lg` is a size and no longer a font family.

  Custom properties that end in a part and share the name before it, as Style Dictionary and Tokens Studio write them, form one type style: `--type-title-font-size`, `--type-title-line-height` and `--type-title-font-weight` show as `--type-title-*`, one sample line in the whole style with its parts under it. A style needs a font size and one other part. The token filter finds a style by the name of any of its custom properties.

### Patch Changes

- Updated dependencies []:
  - @describe-me/core@0.11.0

## 0.10.0

### Minor Changes

- [#112](https://github.com/grzehub/describe-me/pull/112) [`23ae356`](https://github.com/grzehub/describe-me/commit/23ae356b2e9b20792278482a7370e6ee82e9b700) Thanks [@grzehub](https://github.com/grzehub)! - The viewer can hide its sidebar and its inspector. The first row of a test, an overview and Foundations starts with a toggle for the sidebar and ends with one for the inspector, and `[` and `]` do the same. Until you toggle a panel, the window's width decides: below 1100 px the inspector starts hidden, below 800 px the sidebar too. A toggled panel stays as you left it, kept per project in `localStorage` like the sidebar's width. `/` and a tag in the inspector show a hidden sidebar.

  A test's path too long for its row gives up its `describe` blocks first, then ends the test's name in an ellipsis, and its title shows it whole.

- [#109](https://github.com/grzehub/describe-me/pull/109) [`71a008c`](https://github.com/grzehub/describe-me/commit/71a008ca85bd06eecaf576674fbaccd18ff601ca) Thanks [@grzehub](https://github.com/grzehub)! - `describe-me dev` serves the live preview through its own port, under `/__describe-me/`, so the viewer and Live share one address, and one forwarded port, in a container or a web IDE such as Codespaces or StackBlitz, reaches both. The live server still runs on a free port on localhost, now with `/__describe-me/` as its Vite `base`, so its modules and HMR socket sit under that path, and the CLI proxies every request and websocket under the path to it. `__live.json` says `ready` with the base `__describe-me/`, relative to the viewer, the way a static site says `__live/`. `createLiveServer()` in `@describe-me/vitest/live` returns `origin`, the server's `http://localhost:<port>`, next to `base`; a live server of an earlier version has none, and the viewer then opens its absolute base as before.

- [#111](https://github.com/grzehub/describe-me/pull/111) [`73474c5`](https://github.com/grzehub/describe-me/commit/73474c59dc261149d908e324b0641bf3070c0542) Thanks [@grzehub](https://github.com/grzehub)! - The viewer's header shows the project's name after the sygnet, and the tab's title reads `<project> · describe-me`, so two viewers tell apart. The reporter writes the name to the manifest's new `project` field: the `name` of the nearest package.json at or above the Vitest root, else the root directory's name. A manifest without it, from an earlier version, keeps the `describe(me)` wordmark.

### Patch Changes

- [#106](https://github.com/grzehub/describe-me/pull/106) [`f1916c6`](https://github.com/grzehub/describe-me/commit/f1916c68548c280ee5edaf8464c148bb28fe0e64) Thanks [@grzehub](https://github.com/grzehub)! - The viewer's header carries the brand: the sygnet before the wordmark, which now reads `describe(me)`, and the same drawing as the favicon of the page.

- [#113](https://github.com/grzehub/describe-me/pull/113) [`a9fffdc`](https://github.com/grzehub/describe-me/commit/a9fffdc68e233657b49311f7ee034c8b22cfcf96) Thanks [@grzehub](https://github.com/grzehub)! - The sidebar's edge lights up as a line as thin as its border, on that border, so a hovered or focused edge no longer paints over the stage.
- Updated dependencies [[`73474c5`](https://github.com/grzehub/describe-me/commit/73474c59dc261149d908e324b0641bf3070c0542)]:
  - @describe-me/core@0.10.0

## 0.9.0

### Minor Changes

- [#94](https://github.com/grzehub/describe-me/pull/94) [`e0c80ad`](https://github.com/grzehub/describe-me/commit/e0c80ada45a7fd6607157655f40371a80a57b494) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The reporter writes the design-system foundations of the project to `foundations.json` next to `manifest.json`. It lists the design systems that `package.json` and `components.json` name (Tailwind, shadcn/ui, Material UI, Chakra UI, Mantine, Radix Themes, styled-components, Emotion, Ant Design), the recorded stylesheets that declare custom properties on `:root`, `:host`, `html`, `.dark`, `.light` or `[data-*]`, and the stylesheets with `@font-face`. It also holds the Tailwind 4 theme, each token marked `project` or `default`. The option `foundations: { theme: 'src/theme.ts' }` (or `'src/theme.ts#name'`) adds the tokens of a Material UI theme or a plain theme object, with `light-dark()` values split into light and dark. `foundations: false` switches it off, and `DescribeMeReporterOptions` takes the same option. The manifest has an optional `foundations` field with the systems, the token count and the problems. `manifestDiagnostics()` returns the problems as `foundationsErrors`, which the terminal and the viewer's diagnostics menu show. `foundationsErrors` is a new required member of `ManifestDiagnostics`, so code that builds a `ManifestDiagnostics` object itself has to add it. `@describe-me/core/types` exports `Foundations`, `FoundationsSheet`, `FoundationsSystem`, `FoundationToken`, `FoundationGroup`, `FoundationTokenType`, `DesignSystemId` and `ManifestFoundations`. When `describe-me build` vendors fonts, it points the copied `foundations.json` at the moved style chunks.

- [#96](https://github.com/grzehub/describe-me/pull/96) [`162099b`](https://github.com/grzehub/describe-me/commit/162099b36eca315295bbaf080fd0a4e9e271c959) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Foundations shows the structure of Tailwind 4, shadcn/ui and Material UI. Tailwind gets its project color ramps as large swatches, its default palette in a compact grid with a note on how to remove it, the type scale with line heights, font families, weights, tracking and leading, a spacing scale of `--spacing` multiples, box, inset, drop and text shadows, breakpoints and containers, easing, animations and transitions. shadcn/ui gets its background and foreground pairs as an `Aa` specimen with the WCAG contrast ratio and level for the mode on screen, its chart and sidebar colors, and `--radius` with the `--radius-*` derived from it. Material UI gets its palette by intent with `main` behind `contrastText`, the greys as a ramp, text, background and divider, the 13 typography variants, `spacing(n)`, shape, breakpoints, the 25 elevations, z-index and transitions, from a theme module or from the `--mui-*` variables of `cssVariables: true`. Without either, the view says what to set. Other design systems get blocks by name prefix, such as `--chakra-colors-*`. Framework defaults carry a `default` badge, and blocks have readable names. A filter matches tokens by name and value, and `/` focuses it while Foundations is open.

- [#95](https://github.com/grzehub/describe-me/pull/95) [`2184616`](https://github.com/grzehub/describe-me/commit/2184616bca9bb528093de3304860f6d300ca2b23) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The viewer has a Foundations view for the design tokens in `foundations.json`. When the run found tokens, a Foundations entry at the top of the sidebar names the design systems and opens one section per group, each with its count: colors, typography, spacing, radius, shadows, breakpoints, motion and other. Specimens render in a sandboxed iframe with the project's own token and font stylesheets, so fonts and `var()` are real. A value that refers to other tokens shows what it resolves to, such as `var(--radius) → 0.625rem`. A theme module wins over Material UI's `--mui-*` variables, the Tailwind theme wins over the variables Tailwind writes, and `@theme inline` color aliases give way to the custom properties they point at. The stage background switch sits at the top of the view. `dark` shows the dark variant that the project declares with a `.dark` class, a `[data-*="dark"]` attribute, `prefers-color-scheme`, `light-dark()` or the dark mode of a theme module. The inspector names the systems, the Tailwind entry, the theme module, the stylesheets, the dark variant and the problems. The link keeps the section as `foundations=<section>`. The viewer fetches `foundations.json` only when the view opens.

- [#101](https://github.com/grzehub/describe-me/pull/101) [`2b4423f`](https://github.com/grzehub/describe-me/commit/2b4423f27c3567f3f3c0f568295549919d6db8bf) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Live is the default. When the live preview is ready, the selected test opens in Live instead of its recorded frame. `live=0` in the link opens the recorded frame 0 and `frame` opens that recorded frame, so links to frames keep working. A `live=1` link of an earlier version still opens Live. In Live the link has neither `live` nor `frame`. `L` and the Live toggle switch, ← → and a click on the timeline leave Live, and ↑ ↓ and the sidebar keep the mode. Without a live preview the viewer shows the recorded frames as before. While the preview starts the recorded frame shows, and the test switches to Live once it is ready.

- [#97](https://github.com/grzehub/describe-me/pull/97) [`1c676fc`](https://github.com/grzehub/describe-me/commit/1c676fcce1ea58eb0f75291a1e92b14e08caf498) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Foundations marks the Material UI defaults of a theme module. The reporter imports `createTheme` from the project's own `@mui/material/styles`, builds a theme with the same light and dark schemes and `cssVariables` and nothing else, and marks each token with the same value as `default`. A typography variant counts only when every part matches. When only the light or only the dark value is a default, the token gets `modeOrigins`, a new optional field of `FoundationToken`, and the view shows the `default` badge for the mode on screen. When `@mui/material/styles` does not import or has no `createTheme`, the tokens stay `project` and `foundationsErrors` says so in one sentence. A project that uses Material UI without `foundations.theme` and without `cssVariables` keeps `foundations.json` and the manifest's `foundations` summary at 0 tokens. Its Foundations entry shows, and the page holds only the setup hint, which also says that only a theme module marks the defaults.

- [#98](https://github.com/grzehub/describe-me/pull/98) [`f26afe9`](https://github.com/grzehub/describe-me/commit/f26afe96ae463b44cb9195d3eb4f8d9b106290b3) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - `bg=dark` on the stage shows the project's dark variant. Replayed frames, the overview's thumbnails and the test in Live get the `.dark` class or the `[data-*="dark"]` attribute that Foundations detects on their root, so a shadcn/ui component shows its dark colors. `light`, `auto` and `transparent` leave the root as the test recorded it, and a frame recorded in its dark variant stays dark. The variant comes from `foundations.json`, so without tokens `bg=dark` sets only the color scheme, as before. In Live the viewer posts the variant to the live page. The page applies it without a reload once the test has rendered, and takes back only what it applied. `@describe-me/core/types` exports `VIEWER_MESSAGE_SOURCE`, `DarkVariantRoot`, `ViewerRequest` and `ViewerMessage`, and `@describe-me/core/live` exports `listenToViewer()`. The live page accepts the message only from the window that frames it, from the origin its URL names. A live page of an earlier version ignores it, so `LIVE_PROTOCOL` stays 1.

- [#102](https://github.com/grzehub/describe-me/pull/102) [`cead9e2`](https://github.com/grzehub/describe-me/commit/cead9e2872c09e6e43f91a880cc5e10168ba7afa) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The stage's canvas takes the background of the page in its frame. When a frame's `html`, or its `body` when `html` paints none, has a `background-color` at least half opaque, the canvas around the frame gets that color under `auto`, `light` and `dark`, in replay, in Live and in the overview's thumbnails. A page that paints its body shows no band at its edges. `transparent` keeps the checkerboard. `auto` takes the color scheme the page declares on its root, or dark when it paints `html` or `body` dark, as before, and otherwise follows the viewer theme: the theme picked in the header, or the system's scheme under `system`. A frame that `auto` puts on the dark canvas gets the dark color scheme and the dark variant, as under `bg=dark`. Under `auto` a change of the viewer theme repaints the stage, the thumbnails and Live, without reloading the live frame. Under `light`, `dark` and `transparent` the viewer theme changes nothing, and Foundations ignores it as before. A replayed frame on the dark canvas whose CSS has no dark variant gets a note that it has only a light variant, and with Material UI that `cssVariables: true` records both. The live page reports the computed `background-color` of `<html>` and `<body>` just before its status and after every change. `LiveReport` in `@describe-me/core/types` has a `background` member with `html` and `body` strings, so code that handles every report type gets one more. A viewer of an earlier version ignores the report, and with a live page that never sends it the canvas keeps the switch's color, so `LIVE_PROTOCOL` stays 1.

### Patch Changes

- [#90](https://github.com/grzehub/describe-me/pull/90) [`753a3ee`](https://github.com/grzehub/describe-me/commit/753a3ee1869d334c9656086599be6df425e4c7c8) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Recorded data and the static site no longer name the machine that ran the tests. Snapshots drop every `<script>`, which the viewer never runs. Vite's `data-vite-dev-id` becomes a path relative to the project root, or a `node_modules/…` path for a package outside it, or is left out. Test errors, `setupWarnings` and `assetsMissing` name files relative to the root, so an `assetsMissing` entry outside the root reads `../…` or `node_modules/…` instead of `/@fs/<absolute path>`. `describe-me build` writes a project id as `root` in the site's copy of the manifest, and the live build names source files relative to the root. `.describe-me/manifest.json` keeps the absolute `root`. Snapshot hashes change once. A filtered run keeps the snapshots an earlier version wrote for the tests it skips, so run the whole suite once after upgrading.
- Updated dependencies [[`e0c80ad`](https://github.com/grzehub/describe-me/commit/e0c80ada45a7fd6607157655f40371a80a57b494), [`1c676fc`](https://github.com/grzehub/describe-me/commit/1c676fcce1ea58eb0f75291a1e92b14e08caf498), [`753a3ee`](https://github.com/grzehub/describe-me/commit/753a3ee1869d334c9656086599be6df425e4c7c8), [`f26afe9`](https://github.com/grzehub/describe-me/commit/f26afe96ae463b44cb9195d3eb4f8d9b106290b3), [`cead9e2`](https://github.com/grzehub/describe-me/commit/cead9e2872c09e6e43f91a880cc5e10168ba7afa)]:
  - @describe-me/core@0.9.0

## 0.8.0

### Minor Changes

- [#87](https://github.com/grzehub/describe-me/pull/87) [`b9a39f3`](https://github.com/grzehub/describe-me/commit/b9a39f30d68f14aec5a1228a5e37b29a445d5404) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Live shows that it is loading. Until the live page reports its first status, the recorded frame stays on the stage under the live frame, dimmed and with a shimmer, and the dot of the Live toggle pulses. With no recorded frame on the stage, after Restart or a change of test in Live, the shimmer runs on the empty canvas. Any status ends it, a failure too. The live frame fades in over 150 ms while the recorded frame fades out. With `prefers-reduced-motion: reduce` there is no shimmer, pulse or fade, only the dimmed frame.

- [#84](https://github.com/grzehub/describe-me/pull/84) [`d8dec54`](https://github.com/grzehub/describe-me/commit/d8dec54a1af9c70631248145a626767d5e75ab55) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Long props tables fold in the viewer. A props table with more than 12 props, in the component overview or in the inspector, shows the first 10 and a "Show N more" button under them. "Show fewer" folds it again. An unfolded table stays unfolded until the page reloads, per component in the overview and per test in the inspector.

- [#83](https://github.com/grzehub/describe-me/pull/83) [`a80497a`](https://github.com/grzehub/describe-me/commit/a80497ab75fd9a5e47aa7456282eb093d349a386) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The viewer's sidebar is resizable. Drag its right edge, or focus the edge with Tab and press ← or →, to set a width between 216 px and half the window. A double-click on the edge sets it back to 296 px. The browser keeps the width in `localStorage` per project, like the collapsed rows. It is not part of the link.

- [#82](https://github.com/grzehub/describe-me/pull/82) [`5c922ee`](https://github.com/grzehub/describe-me/commit/5c922ee5b09a50b36ca85a4c2dace19cc4e29567) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Frames stand on the stage without a card. The slot and its iframe have no background, rounded corners, ring or shadow, so a frame shows only what the page's own CSS paints. A live frame loses its accent ring too, and only the Live toggle in the toolbar shows that Live is on.

  A background switch next to the viewport presets picks the canvas: `auto` (default), `light`, `dark` or `transparent` (a checkerboard). It also sets the frame's `color-scheme`, so `prefers-color-scheme` inside the frame follows the switch, not the system. `auto` is light unless the recorded page declares a dark scheme on its root or paints its `html` or `body` dark. The overview's thumbnails follow the switch. The link keeps it as `bg=light|dark|transparent`.

  - Behaviour change: on a system in dark mode, frames used to show the component's `prefers-color-scheme: dark` rules on a white card. `auto` now shows them light, unless the page declares a dark scheme. Pick `dark` to see them.
  - Every replayed frame and the live page start their `<head>` with `:where(:root) { color-scheme: light dark }`, so the frame follows the switch. A page that sets its own `color-scheme` keeps it.

- [#86](https://github.com/grzehub/describe-me/pull/86) [`2f5371f`](https://github.com/grzehub/describe-me/commit/2f5371fc1c1445b83c290c880cbb91525259f5f3) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - A theme switch at the right end of the viewer's header: `system` (default), `light` or `dark`. The choice is the same for every project. The browser keeps it in `localStorage` under `describe-me:theme`, and it is not part of the link. Without storage it works until a reload.

  The stored theme applies before the first paint, in `describe-me dev` and in a static site, so the viewer never shows the other scheme first. The theme changes only the viewer's own colors. A frame keeps the canvas and the color scheme that the background switch picks.

### Patch Changes

- [#89](https://github.com/grzehub/describe-me/pull/89) [`bcf267d`](https://github.com/grzehub/describe-me/commit/bcf267dc678cd5f12edb347cafb477bc44ecd85f) Thanks [@grzehub](https://github.com/grzehub)! - An overview with several components shows the thumbnails of every component's states gallery. Only the last gallery used to paint, and the others stayed empty.
- Updated dependencies []:
  - @describe-me/core@0.8.0

## 0.7.0

### Minor Changes

- [#78](https://github.com/grzehub/describe-me/pull/78) [`7b64ddd`](https://github.com/grzehub/describe-me/commit/7b64ddde00c6924cfab2f2e1a903517e8ea8250f) Thanks [@sebastianmusial](https://github.com/sebastianmusial)! - Tags in the viewer. A test's Vitest tags show next to its name and in the inspector, and the search matches them. A click on a tag in the inspector narrows the sidebar to the tests with that tag. The tag is part of the link (`tag=`), × above the tree clears it, and ↑ ↓ follow it. `docs` and `no-docs` do not show.

  - `@describe-me/core/types` exports `DOCS_TAG` and `NO_DOCS_TAG`, which `@describe-me/vitest` now takes from there.

### Patch Changes

- Updated dependencies [[`eb691d4`](https://github.com/grzehub/describe-me/commit/eb691d4a8f27eb1e061f7fec765379c579cf48d4), [`7b64ddd`](https://github.com/grzehub/describe-me/commit/7b64ddde00c6924cfab2f2e1a903517e8ea8250f)]:
  - @describe-me/core@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies []:
  - @describe-me/core@0.6.1

## 0.6.0

### Minor Changes

- [#72](https://github.com/grzehub/describe-me/pull/72) [`24bd710`](https://github.com/grzehub/describe-me/commit/24bd710bae3f606314afb3f0128be0944b5da3fd) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Live in the viewer. `describe-me dev` starts the live preview next to the viewer, on the root and config file the manifest names, and prints its address. The **Live** toggle at the start of the toolbar, the `L` key or `live=1` in the link mounts the selected test the way its arrange phase set it up. Clicks and timers are real. The inspector shows the live status and its reason, each call of a `vi.fn()` prop as an action, the errors the component throws, notices and a Restart button for a fresh start.

  - `describe-me dev --no-live` starts the viewer alone. `--root <dir>` points the live preview at another project root, with the config file Vitest picks there.
  - A live preview that cannot start leaves the viewer running without Live, and the toggle's tooltip says why.

- [#73](https://github.com/grzehub/describe-me/pull/73) [`39ede6d`](https://github.com/grzehub/describe-me/commit/39ede6dcf0569c7245acc231cfa27330aa968e38) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Live preview of setup files and fixtures. The live page imports the project's `test.setupFiles` before the test file, under the same shims, and their hooks run as in Vitest. It computes the `test.extend` fixtures a test uses, without their teardown. It runs `aroundEach` and `aroundAll` around the rest of the arrange phase, and names `each` and `for` rows the way the installed Vitest does.

  - `describeMe({ live })`: `live: { setupFiles }` replaces `test.setupFiles` for the live preview, for a setup file that needs Node such as MSW's `setupServer`. `live: false` switches the preview off for the project. Test runs ignore the option.
  - `LiveStatus` adds `setup-failed`: a setup file did not load in the browser. The detail names the file.
  - `vi.mock` and `vi.doMock` still do nothing live. The page posts a `notice` that names the module, and the inspector lists it.
  - A package that imports `vitest`, such as `@testing-library/jest-dom/vitest`, gets the shim too.
  - The plugin exposes `api.live.enabled`. With `live: false`, `createLiveServer()` rejects with the code `DESCRIBE_ME_LIVE_OFF`, and `describe-me dev` reports the preview as off and hides the Live toggle.
  - `LivePageOptions` of `@describe-me/vitest/live-runtime` takes `setupFiles` and `vitestMajor`.
  - The recording hooks destructure the test context, so a test from `test.extend` no longer fails in Vitest with "The 1st argument inside a fixture must use object destructuring pattern".

- [#74](https://github.com/grzehub/describe-me/pull/74) [`dcafdb6`](https://github.com/grzehub/describe-me/commit/dcafdb63b6e720e016a29ee532bac7d5e584c9dc) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Live on the static site. `describe-me build --live` builds the live preview into the site as `__live/` and writes `__live.json`, so the viewer of a static site shows the Live toggle and mounts a test the way `describe-me dev` does. Without `--live` the site has no Live, as before. With it, the site holds the compiled code of the components, the test files and the setup files, with their test data.

  - `buildLive({ root, configFile?, outDir, testFiles })` in `@describe-me/vitest/live` builds the live page with the project's own Vite and config, in mode `test`, as a development build. It bundles `live.html`, the setup files and a lazy import of each test file, with a relative base, unminified so that names taken from functions stay as Vitest sees them. It resolves to `{ protocol }`, and rejects with the code `DESCRIBE_ME_LIVE_OFF` when the config sets `live: false`.
  - An import that does not load in the browser, such as `node:fs`, does not stop the build. The build warns, and the page reports `import-failed` for a test file that imports it, or `setup-failed` for a setup file.
  - `describe-me build` takes `--live` and `--root`. A live build that fails stops the command with exit code 1 and leaves no `__live/`.
  - The viewer reads a relative `base` from `__live.json` and frames the live page on its own origin.

### Patch Changes

- Updated dependencies [[`fdb8a2b`](https://github.com/grzehub/describe-me/commit/fdb8a2bb79651478b98b602a71564fd9001109e4), [`39ede6d`](https://github.com/grzehub/describe-me/commit/39ede6dcf0569c7245acc231cfa27330aa968e38)]:
  - @describe-me/core@0.6.0

## 0.5.4

### Patch Changes

- [#66](https://github.com/grzehub/describe-me/pull/66) [`1b27eca`](https://github.com/grzehub/describe-me/commit/1b27ecac9d21d5a3940bd7027139282f56665e4b) Thanks [@grzehub](https://github.com/grzehub)! - The package pages on npm point at the docs site. Every README opens with a link to the docs and the two live example viewers, explains which package you need, and shares one quick start. The details moved to the docs pages they link. The package descriptions and keywords are aligned, and `visual testing` is gone from the keywords because describe-me does no visual regression testing.
- Updated dependencies [[`1b27eca`](https://github.com/grzehub/describe-me/commit/1b27ecac9d21d5a3940bd7027139282f56665e4b)]:
  - @describe-me/core@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @describe-me/core@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`de9aad9`](https://github.com/grzehub/describe-me/commit/de9aad9c5070af81a22e9e3119c6b2712093bb40)]:
  - @describe-me/core@0.5.2

## 0.5.1

### Patch Changes

- [#49](https://github.com/grzehub/describe-me/pull/49) [`2130974`](https://github.com/grzehub/describe-me/commit/2130974e4a926bd8470c90fb8d0e413c009b57b0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Docs.

  - **One version for every describe-me package.** Each package README says to install and upgrade them together.
  - **`describe-me build` and the network.** The viewer README names the font hosts `build` contacts, what an unreachable host costs, and how `--no-vendor-fonts` keeps the build offline.

  No code or API changes.

- [#45](https://github.com/grzehub/describe-me/pull/45) [`63a2761`](https://github.com/grzehub/describe-me/commit/63a27619480ec413e88c95c3cc54e2ba987ea221) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - In jsdom, styled-components 6.0 to 6.3 no longer fail to load under Vite 6 and 7. These versions import tslib, and the optimizer bundled tslib's UMD file without its default export, so every test that imported styled-components failed with `Cannot destructure property '__extends' of 'import_tslib.default'`. The plugin points `tslib` at the `tslib.es6.mjs` that styled-components resolves. A `tslib` alias in your own `vitest.config.ts` is no longer needed.

  When that tslib is older than 2.5.3 and has no `tslib.es6.mjs` (styled-components 6.1.3 to 6.1.9 pin 2.5.0), the plugin leaves tslib alone and warns after the run: upgrade styled-components to 6.1.10 or later, or override tslib to 2.5.3 or later. The viewer lists the same warning behind its issues chip.

  Public API:

  - `@describe-me/core/types`: `Manifest.setupWarnings` and `ManifestDiagnostics.setupWarnings`. The second is a required member, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add it.
  - `@describe-me/vitest/reporter`: the `setupWarnings` option of `DescribeMeReporterOptions`.

  No existing export is renamed or removed.

- [#43](https://github.com/grzehub/describe-me/pull/43) [`6e36104`](https://github.com/grzehub/describe-me/commit/6e36104f73f59946845193e64e9cea97fea78f58) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - `describe-me build` keeps the built site consistent after it vendors fonts.

  - **The issues menu lists only hosts that stay remote.** The copied manifest's `remoteStylesheets` is counted again from the vendored snapshots, style chunks and CSS assets, the way the reporter counts it. A host whose stylesheets were all downloaded is no longer listed.
  - **Rewritten style chunks and CSS assets are named after their new text.** Every snapshot, chunk, CSS asset and preview head that names one is updated, and the old file is removed. After a redeploy, a browser can no longer use a cached chunk or CSS asset that points at files the site no longer has.

  Snapshot files keep their names, because the viewer always fetches them fresh. The source data directory and `describe-me dev` are unchanged. No exports change.

- [#42](https://github.com/grzehub/describe-me/pull/42) [`75e9837`](https://github.com/grzehub/describe-me/commit/75e983729c68dd157619f1c7ab7601b70612bdd9) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - A guard against mixed describe-me versions in one project.

  - **A clear error instead of `is not a function`** (`@describe-me/core`). The shared test recorder carries a protocol number, `recorder.protocol`. When a copy of `@describe-me/core` finds a recorder that a copy with another protocol created, importing it throws "describe-me: all describe-me packages must be on the same version…". A recorder created by 0.5.0 is accepted. One created by 0.4 is not, so `@describe-me/react` 0.5.1 with `@describe-me/vitest` 0.4 fails every test file with that message.
  - **The manifest names its writer** (`@describe-me/core`, `@describe-me/vitest`). `manifest.json` gets `generator: { name, version }`, the reporter package and its version. The type is `Manifest.generator?: ManifestGenerator`, absent in manifests written before 0.5.1.
  - **The viewer warns about data from another version** (`describe-me`). A banner under the header names both versions when their major.minor differs. Data without `generator` shows no banner, because this viewer reads everything written before 0.5.1.
  - **Peer dependencies between the packages** (`@describe-me/react`, `@describe-me/vitest`). `@describe-me/react` peers on `@describe-me/vitest`, and `@describe-me/vitest` has an optional peer on `describe-me`. Both ranges start at this release (`^0.5.1`), so the package manager reports a mix at install time.

  Added: the `ManifestGenerator` type (`@describe-me/core`, `@describe-me/core/types`) and the read-only `recorder.protocol`. Nothing removed or renamed.

- [#46](https://github.com/grzehub/describe-me/pull/46) [`e2803f0`](https://github.com/grzehub/describe-me/commit/e2803f05ef30cf6565c84e10e2dee5a6e3770fa6) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Viewer fixes.

  - **The selected test is revealed after an overview.** Coming back from an overview expands the test's collapsed module or suite and scrolls its row into view. From a test hidden in a collapsed suite, ↓ and ↑ open the nearest row the sidebar shows, not the first or last test of the list.
  - **↑ and ↓ add no history entries.** Stepping through tests replaces the current entry, like stepping through frames.
  - **Failed loads are tried again.** The viewer retries a missing `styles/` chunk once after half a second. A frame whose styles came back incomplete, or whose snapshot failed, loads again the next time it is shown. It no longer stays broken until the next run.
  - **A note names fonts that did not load.** Under the frame, the viewer lists the web fonts and stylesheets that failed to load in the browser, for example offline in `describe-me dev`.
  - **Auto height for content sized to the viewport.** A full-height layout or a dialog on a backdrop gets the stage's height. A centred dialog taller than the stage gets room for all of it instead of being cut off at the top.
  - **A fixed height of at least 120 px.** A smaller `h` in the link or the H field is raised to 120, the floor auto height already uses.

  Nothing added to or removed from any package's exports.

- Updated dependencies [[`2130974`](https://github.com/grzehub/describe-me/commit/2130974e4a926bd8470c90fb8d0e413c009b57b0), [`43d8a2e`](https://github.com/grzehub/describe-me/commit/43d8a2e43178be0639b905fd91591ef6b3d30c76), [`63a2761`](https://github.com/grzehub/describe-me/commit/63a27619480ec413e88c95c3cc54e2ba987ea221), [`75e9837`](https://github.com/grzehub/describe-me/commit/75e983729c68dd157619f1c7ab7601b70612bdd9)]:
  - @describe-me/core@0.5.1

## 0.5.0

### Minor Changes

- [#33](https://github.com/grzehub/describe-me/pull/33) [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The reporter lists the font families that frames use but nothing loads, and the hosts that frames load stylesheets from.

  - **New manifest fields** `Manifest.fontsMissing` (`FontMissing[]` with `family`, `tests` and `testId`, the first test that misses it) and `Manifest.remoteStylesheets` (`RemoteStylesheet[]` with `host` and `frames`). Both types are exported from `@describe-me/core` and `@describe-me/core/types`. Manifests written before this version do not have them, which counts as empty.
  - **`ManifestDiagnostics` has two new required members**, `fontsMissing` and `remoteStylesheets`, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add them.
  - A family counts as missing when it is the first family of a `font-family` or `font` declaration, with `var()` followed, and it is neither a generic or system family nor loaded by an `@font-face` rule, Google Fonts, Bunny Fonts or Fontsource on jsDelivr, in the frame or in the preview head. A stylesheet from any other host turns the check off for that frame, or for every frame when the preview head links it. So Adobe Fonts and custom CDNs never cause false alarms.
  - The reporter prints one warning line for each list. The viewer's issues chip shows both, and each missing family links to its first test.

  No existing export is renamed or removed.

- [#29](https://github.com/grzehub/describe-me/pull/29) [`26d38dc`](https://github.com/grzehub/describe-me/commit/26d38dc3561436e5bf4b4c27b48de2be81eb1bae) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Fonts and other page-level resources can be added to every replayed frame with the new `previewHead` option, and CSS files copied into `assets/` keep their fonts and images.

  - **New option `previewHead`** (`string`) on the plugin (`@describe-me/vitest/plugin`) and the reporter (`@describe-me/vitest/reporter`). It is HTML the viewer adds to the start of the `<head>` of every frame and thumbnail, like Storybook's `preview-head.html`. It never reaches the test page. Local files it links with `href` or `src` are copied into `assets/`, and so are the `url()` targets in its `<style>` blocks and `style` attributes. Remote URLs load from the network in the viewer. The reporter warns when it contains a `<script>`, because the viewer never runs scripts.
  - **New manifest field `Manifest.head`** (`@describe-me/core`): the preview head with local files as `describe-me-asset:` URLs. It is absent when `previewHead` is not set.
  - **New export `cssReferences()`** and its type `CssReference`, from `@describe-me/core` and the new entry point `@describe-me/core/css-references`. It lists the `url()` and `@import` references in CSS text with their positions. An unquoted URL runs until the closing parenthesis, so Google Fonts `css2` URLs, which contain semicolons, are read whole.
  - **Copied CSS files keep working.** When a project `.css` file is copied into `assets/`, its `url()` and `@import` targets are copied too and referenced by their stored names. A font declared in a linked `fonts.css` used to fail with a 404 in the viewer. Only fonts, images, cursors and CSS files are pulled in this way. Targets that cannot be found are listed in `assetsMissing`. CSS assets written by earlier versions stay as they are until their tests run again.
  - Garbage collection also keeps the assets the preview head refers to, and every file a kept CSS asset refers to.
  - The viewer waits up to 3 seconds for web fonts, then fits the stage and the thumbnails again, so the frame height matches the loaded font.

  No existing export changes.

- [#24](https://github.com/grzehub/describe-me/pull/24) [`48cbc2a`](https://github.com/grzehub/describe-me/commit/48cbc2ab5071494328a252659a1514c914fa5ad5) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Tests that render nothing are left out, and new `include` / `exclude` options choose which test files are recorded.

  - **Empty tests are skipped.** A test that records no frame before the closing one (no recording `render`, no interaction, no `step()`) now costs nothing: `recorder.capture('end', …)` returns before settling or taking a snapshot, and the reporter leaves the test out of the manifest. This includes failed tests without frames. Vitest still reports the failure. A test that renders outside the recording `render` (for example with `createRoot` by hand) is now left out too. Call `step()` to keep it. The viewer also hides such tests, and modules left empty, in data written by older versions.
  - **Filtered runs keep documentation.** A test skipped in a run (`.only`, `-t`, `.skip`) keeps the entry the previous run recorded for it, when its id and full name match.
  - **New plugin options `include` and `exclude`** (`string | string[]`): globs relative to the Vitest root, matched with picomatch, dotfiles included. `exclude` wins. Tests in other files still run but are not recorded, and their modules are removed from the manifest, including ones kept from an earlier run.
  - **New reporter options `include` and `exclude`** on `@describe-me/vitest/reporter`, with the same effect on the manifest. Without the plugin the setup file does not know them, so those tests are still recorded.
  - Concurrent tests (`test.concurrent`, `describe.concurrent`, `sequence.concurrent`) are not recorded, since they would share one recorder. The setup file warns once per file.
  - The plugin hands its runtime options to the setup files through Vitest's `provide` / `inject` under the key `'describe-me'`, which `@describe-me/vitest` declares on Vitest's `ProvidedContext`. Do not provide that key yourself.
  - `@describe-me/vitest` now depends on `picomatch` (already installed with Vitest).

  No exports added or removed.

- [#25](https://github.com/grzehub/describe-me/pull/25) [`c877e0e`](https://github.com/grzehub/describe-me/commit/c877e0edddf20805814b3872088ad68272de8b1a) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Stylesheets are stored once instead of inside every snapshot.

  - The reporter moves every captured stylesheet of 256 characters or more out of the snapshot into `styles/<hash>.css` in the output directory. Sheets are split between top-level rules into chunks of about 4 KB, and the snapshot keeps a reference (`describe-me-style:<hash>+<hash>…`). A large styled-components `<style data-styled>` sheet that grows from test to test shares most of its chunks, so each rule is stored about once. Smaller sheets stay inline.
  - Garbage collection after each run removes unreferenced snapshots, then unreferenced style chunks, then assets that neither a snapshot nor a style chunk refers to. Fonts and images used only from CSS are kept.
  - The viewer loads each chunk once per session and shares rrweb's CSS processing between the stage and the thumbnails.
  - **New export (`@describe-me/core`):** `STYLE_URL_PREFIX` (`'describe-me-style:'`), the prefix of style references inside stored snapshots.
  - **Output format change:** snapshot file names change, so the first run after upgrading rewrites them and garbage-collects the old ones. The viewer still reads output written by 0.4. The 0.4 viewer cannot read this output (frames show without their stylesheets), so upgrade `describe-me` together with `@describe-me/vitest`.

- [#35](https://github.com/grzehub/describe-me/pull/35) [`d189a66`](https://github.com/grzehub/describe-me/commit/d189a66476fc006500a878f08527996753f06e62) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - `describe-me build` downloads web fonts into the static site, so the published docs show them without network access.

  - Stylesheets from Google Fonts (`fonts.googleapis.com/css`, `/css2` and `/icon`), Bunny Fonts and Fontsource on jsDelivr are stored in `__data/assets/` with the font files they point at. The build scans the preview head, the snapshots, the style chunks and the copied CSS assets. Links that an app's font loader added and data written by 0.4 are covered too.
  - Requests send a current Chrome User-Agent, so Google serves woff2 files split by `unicode-range`. Every response is checked for type, size and, for fonts, file signature. Redirects must stay on the same hosts. A stylesheet is replaced only when all its files downloaded. Otherwise it keeps loading from the network and the build prints a warning. The build never fails because of it.
  - Adobe Fonts are never downloaded, because their license does not allow self-hosting. Stylesheets and fonts on other hosts stay remote too. The build lists both.
  - Downloads are cached in `node_modules/.cache/describe-me/fonts`. Font files are kept for good and stylesheets for 7 days. A stale stylesheet is used when the network is down, so a build works offline after one online build.
  - New flag `--no-vendor-fonts` turns this off.

  `describe-me dev` and the `.describe-me` directory are unchanged. No export changes.

- [#37](https://github.com/grzehub/describe-me/pull/37) [`ad824ba`](https://github.com/grzehub/describe-me/commit/ad824ba91f52a4d442b1106c6fae01e5b3747af2) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Test ids survive edits to the test file, and the viewer gets history, search, collapsible suites and source order.

  - **`ManifestTest.id` changes meaning** (`@describe-me/core/types`). The reporter writes a stable id: the first 12 hex characters of a SHA-1 of the module path, the suite path, the test name and, for a name repeated in the same suite, its occurrence. It stays the same when other tests are added, removed or reordered, and on other machines. Renaming a test or moving it to another suite or file changes it. `ManifestDiagnostics.anonymous[].testId` holds the same id. Tools that matched manifest ids with Vitest's `TestCase.id` should read `vitestId`.
  - **New field `ManifestTest.vitestId`** (`@describe-me/core/types`): Vitest's `TestCase.id` in the run that recorded the test. Absent in manifests written before this version.
  - The first run after the upgrade gives every test in the manifest its new id, including tests kept from an earlier run, and keeps the old id as `vitestId`.
  - **Old links keep working.** A `#test=` link with a Vitest id opens its test, and the viewer rewrites the link to the new id.
  - **Back and Forward** move between the tests and overviews you opened. Stepping through frames and changing the viewport update the link without adding history entries.
  - **The sidebar follows source order.** A test declared after a nested `describe` is listed after it, not above it.
  - **A search field** at the top of the sidebar filters tests by name, suite, file and component. Every word must match. `/` focuses it, Esc clears it, Enter or ↓ opens the first match.
  - **Files and `describe` blocks collapse** with the arrow next to them. The viewer remembers this per project in the browser's local storage.
  - **↑ and ↓** move through the tests the sidebar shows, in its order.

  No exports added or removed.

- [#32](https://github.com/grzehub/describe-me/pull/32) [`8932d2a`](https://github.com/grzehub/describe-me/commit/8932d2a397ef6b8e4ebaf62069bfc7eb1ffd1ff3) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The viewer keeps its place while you browse.

  - Stepping through frames swaps the replay in place. The next frame is built out of sight and shown once its fonts load, or after 200 ms, so the stage no longer flashes blank. Within a test the stage keeps its scroll position.
  - The sidebar keeps its scroll position when you pick a test or the manifest updates, and the timeline keeps it while you step through frames. The overview keeps its scroll position when the manifest updates. The issues panel stays open until you pick an item in it.
  - Width and height fields sit next to the 100%, 768px and 375px presets. The size is kept in the link as `w` and `h`. A fixed height is used as is, without fitting the frame to its content. A viewport wider than the stage is scaled down to fit, and the toolbar shows the zoom.
  - Keyboard shortcuts are ignored while you type in a field.

  No package exports change. Links without `w` and `h` open at 100% width, as before.

- [#20](https://github.com/grzehub/describe-me/pull/20) [`940d49f`](https://github.com/grzehub/describe-me/commit/940d49f9b565cb32da2461d6086dc60775af8fc4) Thanks [@grzehub](https://github.com/grzehub)! - `describe-me` no longer ships its own Vite. `vite` moved from `dependencies` to `peerDependencies` (`^6.4.0 || ^7.0.0 || ^8.0.0`), so the viewer and CLI run on your project's Vite and a project on Vite 6 or 7 no longer installs a second, nested Vite 8. pnpm and npm install the peer automatically; with yarn, add `vite` to your `devDependencies` (Vitest requires it anyway). `describe-me` now declares `engines.node: ^20.16.0 || >=22.4.0`; the effective floor is whatever your Vite version requires.

  Peer dependency ranges now have upper bounds instead of open-ended `>=` ranges:

  - `@describe-me/react`: `react` `^18.0.0 || ^19.0.0`, `@testing-library/react` `^16.0.0` (optional), `vitest-browser-react` `^2.0.0` (optional).
  - `@describe-me/vitest`: `vitest` `^4.0.0 || ^5.0.0`, `typescript` `^5.0.0 || ^6.0.0` (optional; TypeScript 7 has no JS compiler API), `@testing-library/user-event` `^14.0.0` (optional).

### Patch Changes

- [#40](https://github.com/grzehub/describe-me/pull/40) [`3586e50`](https://github.com/grzehub/describe-me/commit/3586e503347ae0f4fc14f230ec1891d3b662ac8b) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Documentation for the limits of recording in jsdom (positioned popovers, fonts, canvas, concurrent tests) and for the viewer (search, collapsing, keyboard, viewport sizes, links). No code or export changes.
- Updated dependencies [[`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0), [`993012b`](https://github.com/grzehub/describe-me/commit/993012babf8dc61727198729111619f8a5a5562f), [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe), [`26d38dc`](https://github.com/grzehub/describe-me/commit/26d38dc3561436e5bf4b4c27b48de2be81eb1bae), [`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7), [`48cbc2a`](https://github.com/grzehub/describe-me/commit/48cbc2ab5071494328a252659a1514c914fa5ad5), [`c877e0e`](https://github.com/grzehub/describe-me/commit/c877e0edddf20805814b3872088ad68272de8b1a), [`9cc05eb`](https://github.com/grzehub/describe-me/commit/9cc05eb64a9490916596129c27bebb0afbc3318a), [`ad824ba`](https://github.com/grzehub/describe-me/commit/ad824ba91f52a4d442b1106c6fae01e5b3747af2)]:
  - @describe-me/core@0.5.0

## 0.5.0-next.3

### Minor Changes

- [#33](https://github.com/grzehub/describe-me/pull/33) [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The reporter lists the font families that frames use but nothing loads, and the hosts that frames load stylesheets from.

  - **New manifest fields** `Manifest.fontsMissing` (`FontMissing[]` with `family`, `tests` and `testId`, the first test that misses it) and `Manifest.remoteStylesheets` (`RemoteStylesheet[]` with `host` and `frames`). Both types are exported from `@describe-me/core` and `@describe-me/core/types`. Manifests written before this version do not have them, which counts as empty.
  - **`ManifestDiagnostics` has two new required members**, `fontsMissing` and `remoteStylesheets`, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add them.
  - A family counts as missing when it is the first family of a `font-family` or `font` declaration, with `var()` followed, and it is neither a generic or system family nor loaded by an `@font-face` rule, Google Fonts, Bunny Fonts or Fontsource on jsDelivr, in the frame or in the preview head. A stylesheet from any other host turns the check off for that frame, or for every frame when the preview head links it. So Adobe Fonts and custom CDNs never cause false alarms.
  - The reporter prints one warning line for each list. The viewer's issues chip shows both, and each missing family links to its first test.

  No existing export is renamed or removed.

- [#35](https://github.com/grzehub/describe-me/pull/35) [`d189a66`](https://github.com/grzehub/describe-me/commit/d189a66476fc006500a878f08527996753f06e62) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - `describe-me build` downloads web fonts into the static site, so the published docs show them without network access.

  - Stylesheets from Google Fonts (`fonts.googleapis.com/css`, `/css2` and `/icon`), Bunny Fonts and Fontsource on jsDelivr are stored in `__data/assets/` with the font files they point at. The build scans the preview head, the snapshots, the style chunks and the copied CSS assets. Links that an app's font loader added and data written by 0.4 are covered too.
  - Requests send a current Chrome User-Agent, so Google serves woff2 files split by `unicode-range`. Every response is checked for type, size and, for fonts, file signature. Redirects must stay on the same hosts. A stylesheet is replaced only when all its files downloaded. Otherwise it keeps loading from the network and the build prints a warning. The build never fails because of it.
  - Adobe Fonts are never downloaded, because their license does not allow self-hosting. Stylesheets and fonts on other hosts stay remote too. The build lists both.
  - Downloads are cached in `node_modules/.cache/describe-me/fonts`. Font files are kept for good and stylesheets for 7 days. A stale stylesheet is used when the network is down, so a build works offline after one online build.
  - New flag `--no-vendor-fonts` turns this off.

  `describe-me dev` and the `.describe-me` directory are unchanged. No export changes.

- [#37](https://github.com/grzehub/describe-me/pull/37) [`ad824ba`](https://github.com/grzehub/describe-me/commit/ad824ba91f52a4d442b1106c6fae01e5b3747af2) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Test ids survive edits to the test file, and the viewer gets history, search, collapsible suites and source order.

  - **`ManifestTest.id` changes meaning** (`@describe-me/core/types`). The reporter writes a stable id: the first 12 hex characters of a SHA-1 of the module path, the suite path, the test name and, for a name repeated in the same suite, its occurrence. It stays the same when other tests are added, removed or reordered, and on other machines. Renaming a test or moving it to another suite or file changes it. `ManifestDiagnostics.anonymous[].testId` holds the same id. Tools that matched manifest ids with Vitest's `TestCase.id` should read `vitestId`.
  - **New field `ManifestTest.vitestId`** (`@describe-me/core/types`): Vitest's `TestCase.id` in the run that recorded the test. Absent in manifests written before this version.
  - The first run after the upgrade gives every test in the manifest its new id, including tests kept from an earlier run, and keeps the old id as `vitestId`.
  - **Old links keep working.** A `#test=` link with a Vitest id opens its test, and the viewer rewrites the link to the new id.
  - **Back and Forward** move between the tests and overviews you opened. Stepping through frames and changing the viewport update the link without adding history entries.
  - **The sidebar follows source order.** A test declared after a nested `describe` is listed after it, not above it.
  - **A search field** at the top of the sidebar filters tests by name, suite, file and component. Every word must match. `/` focuses it, Esc clears it, Enter or ↓ opens the first match.
  - **Files and `describe` blocks collapse** with the arrow next to them. The viewer remembers this per project in the browser's local storage.
  - **↑ and ↓** move through the tests the sidebar shows, in its order.

  No exports added or removed.

### Patch Changes

- Updated dependencies [[`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0), [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe), [`ad824ba`](https://github.com/grzehub/describe-me/commit/ad824ba91f52a4d442b1106c6fae01e5b3747af2)]:
  - @describe-me/core@0.5.0-next.3

## 0.5.0-next.2

### Minor Changes

- [#32](https://github.com/grzehub/describe-me/pull/32) [`8932d2a`](https://github.com/grzehub/describe-me/commit/8932d2a397ef6b8e4ebaf62069bfc7eb1ffd1ff3) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The viewer keeps its place while you browse.

  - Stepping through frames swaps the replay in place. The next frame is built out of sight and shown once its fonts load, or after 200 ms, so the stage no longer flashes blank. Within a test the stage keeps its scroll position.
  - The sidebar keeps its scroll position when you pick a test or the manifest updates, and the timeline keeps it while you step through frames. The overview keeps its scroll position when the manifest updates. The issues panel stays open until you pick an item in it.
  - Width and height fields sit next to the 100%, 768px and 375px presets. The size is kept in the link as `w` and `h`. A fixed height is used as is, without fitting the frame to its content. A viewport wider than the stage is scaled down to fit, and the toolbar shows the zoom.
  - Keyboard shortcuts are ignored while you type in a field.

  No package exports change. Links without `w` and `h` open at 100% width, as before.

### Patch Changes

- Updated dependencies [[`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7)]:
  - @describe-me/core@0.5.0-next.2

## 0.5.0-next.1

### Minor Changes

- [#29](https://github.com/grzehub/describe-me/pull/29) [`26d38dc`](https://github.com/grzehub/describe-me/commit/26d38dc3561436e5bf4b4c27b48de2be81eb1bae) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Fonts and other page-level resources can be added to every replayed frame with the new `previewHead` option, and CSS files copied into `assets/` keep their fonts and images.

  - **New option `previewHead`** (`string`) on the plugin (`@describe-me/vitest/plugin`) and the reporter (`@describe-me/vitest/reporter`). It is HTML the viewer adds to the start of the `<head>` of every frame and thumbnail, like Storybook's `preview-head.html`. It never reaches the test page. Local files it links with `href` or `src` are copied into `assets/`, and so are the `url()` targets in its `<style>` blocks and `style` attributes. Remote URLs load from the network in the viewer. The reporter warns when it contains a `<script>`, because the viewer never runs scripts.
  - **New manifest field `Manifest.head`** (`@describe-me/core`): the preview head with local files as `describe-me-asset:` URLs. It is absent when `previewHead` is not set.
  - **New export `cssReferences()`** and its type `CssReference`, from `@describe-me/core` and the new entry point `@describe-me/core/css-references`. It lists the `url()` and `@import` references in CSS text with their positions. An unquoted URL runs until the closing parenthesis, so Google Fonts `css2` URLs, which contain semicolons, are read whole.
  - **Copied CSS files keep working.** When a project `.css` file is copied into `assets/`, its `url()` and `@import` targets are copied too and referenced by their stored names. A font declared in a linked `fonts.css` used to fail with a 404 in the viewer. Only fonts, images, cursors and CSS files are pulled in this way. Targets that cannot be found are listed in `assetsMissing`. CSS assets written by earlier versions stay as they are until their tests run again.
  - Garbage collection also keeps the assets the preview head refers to, and every file a kept CSS asset refers to.
  - The viewer waits up to 3 seconds for web fonts, then fits the stage and the thumbnails again, so the frame height matches the loaded font.

  No existing export changes.

### Patch Changes

- Updated dependencies [[`26d38dc`](https://github.com/grzehub/describe-me/commit/26d38dc3561436e5bf4b4c27b48de2be81eb1bae)]:
  - @describe-me/core@0.5.0-next.1

## 0.5.0-next.0

### Minor Changes

- [#24](https://github.com/grzehub/describe-me/pull/24) [`48cbc2a`](https://github.com/grzehub/describe-me/commit/48cbc2ab5071494328a252659a1514c914fa5ad5) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Tests that render nothing are left out, and new `include` / `exclude` options choose which test files are recorded.

  - **Empty tests are skipped.** A test that records no frame before the closing one (no recording `render`, no interaction, no `step()`) now costs nothing: `recorder.capture('end', …)` returns before settling or taking a snapshot, and the reporter leaves the test out of the manifest. This includes failed tests without frames. Vitest still reports the failure. A test that renders outside the recording `render` (for example with `createRoot` by hand) is now left out too. Call `step()` to keep it. The viewer also hides such tests, and modules left empty, in data written by older versions.
  - **Filtered runs keep documentation.** A test skipped in a run (`.only`, `-t`, `.skip`) keeps the entry the previous run recorded for it, when its id and full name match.
  - **New plugin options `include` and `exclude`** (`string | string[]`): globs relative to the Vitest root, matched with picomatch, dotfiles included. `exclude` wins. Tests in other files still run but are not recorded, and their modules are removed from the manifest, including ones kept from an earlier run.
  - **New reporter options `include` and `exclude`** on `@describe-me/vitest/reporter`, with the same effect on the manifest. Without the plugin the setup file does not know them, so those tests are still recorded.
  - Concurrent tests (`test.concurrent`, `describe.concurrent`, `sequence.concurrent`) are not recorded, since they would share one recorder. The setup file warns once per file.
  - The plugin hands its runtime options to the setup files through Vitest's `provide` / `inject` under the key `'describe-me'`, which `@describe-me/vitest` declares on Vitest's `ProvidedContext`. Do not provide that key yourself.
  - `@describe-me/vitest` now depends on `picomatch` (already installed with Vitest).

  No exports added or removed.

- [#25](https://github.com/grzehub/describe-me/pull/25) [`c877e0e`](https://github.com/grzehub/describe-me/commit/c877e0edddf20805814b3872088ad68272de8b1a) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Stylesheets are stored once instead of inside every snapshot.

  - The reporter moves every captured stylesheet of 256 characters or more out of the snapshot into `styles/<hash>.css` in the output directory. Sheets are split between top-level rules into chunks of about 4 KB, and the snapshot keeps a reference (`describe-me-style:<hash>+<hash>…`). A large styled-components `<style data-styled>` sheet that grows from test to test shares most of its chunks, so each rule is stored about once. Smaller sheets stay inline.
  - Garbage collection after each run removes unreferenced snapshots, then unreferenced style chunks, then assets that neither a snapshot nor a style chunk refers to. Fonts and images used only from CSS are kept.
  - The viewer loads each chunk once per session and shares rrweb's CSS processing between the stage and the thumbnails.
  - **New export (`@describe-me/core`):** `STYLE_URL_PREFIX` (`'describe-me-style:'`), the prefix of style references inside stored snapshots.
  - **Output format change:** snapshot file names change, so the first run after upgrading rewrites them and garbage-collects the old ones. The viewer still reads output written by 0.4. The 0.4 viewer cannot read this output (frames show without their stylesheets), so upgrade `describe-me` together with `@describe-me/vitest`.

- [#20](https://github.com/grzehub/describe-me/pull/20) [`940d49f`](https://github.com/grzehub/describe-me/commit/940d49f9b565cb32da2461d6086dc60775af8fc4) Thanks [@grzehub](https://github.com/grzehub)! - `describe-me` no longer ships its own Vite. `vite` moved from `dependencies` to `peerDependencies` (`^6.4.0 || ^7.0.0 || ^8.0.0`), so the viewer and CLI run on your project's Vite and a project on Vite 6 or 7 no longer installs a second, nested Vite 8. pnpm and npm install the peer automatically; with yarn, add `vite` to your `devDependencies` (Vitest requires it anyway). `describe-me` now declares `engines.node: ^20.16.0 || >=22.4.0`; the effective floor is whatever your Vite version requires.

  Peer dependency ranges now have upper bounds instead of open-ended `>=` ranges:

  - `@describe-me/react`: `react` `^18.0.0 || ^19.0.0`, `@testing-library/react` `^16.0.0` (optional), `vitest-browser-react` `^2.0.0` (optional).
  - `@describe-me/vitest`: `vitest` `^4.0.0 || ^5.0.0`, `typescript` `^5.0.0 || ^6.0.0` (optional; TypeScript 7 has no JS compiler API), `@testing-library/user-event` `^14.0.0` (optional).

### Patch Changes

- Updated dependencies [[`993012b`](https://github.com/grzehub/describe-me/commit/993012babf8dc61727198729111619f8a5a5562f), [`48cbc2a`](https://github.com/grzehub/describe-me/commit/48cbc2ab5071494328a252659a1514c914fa5ad5), [`c877e0e`](https://github.com/grzehub/describe-me/commit/c877e0edddf20805814b3872088ad68272de8b1a), [`9cc05eb`](https://github.com/grzehub/describe-me/commit/9cc05eb64a9490916596129c27bebb0afbc3318a)]:
  - @describe-me/core@0.5.0-next.0

## 0.4.0

### Minor Changes

- [#18](https://github.com/grzehub/describe-me/pull/18) [`5c032a3`](https://github.com/grzehub/describe-me/commit/5c032a383a575f35abf2f7df8b1135e743e31203) Thanks [@grzehub](https://github.com/grzehub)! - Components are named after their export. An anonymous `forwardRef`, a `memo(forwardRef(…))` or a styled component exported as `Text` used to be recorded as `Anonymous` or `styled.p`, which left it out of the component overview. The plugin now appends a few lines to every project module (not tests, not node_modules) that register its top-level exports on `globalThis`; the adapter names a component after its export and records the file that defines it, and the reporter reads its props from that file. Props are also read through `forwardRef(…)` and `memo(…)` (defaults included), from generic polymorphic components and from styled-components 6. Switch it off with `describeMe({ registerExports: false })`.

  Project assets (images, videos, local fonts, CSS `url()`s) are copied into `.describe-me/assets/` and load in `describe-me dev` and in the static build, instead of pointing at the test page's origin (`http://localhost:3000` in jsdom), which is gone once the tests end. Paths that cannot be found are listed in `manifest.assetsMissing`.

  In jsdom, styled-components (5 and later) is loaded from its browser build, together with jest-styled-components, because the Node build's `createGlobalStyle` never inserts its CSS on the client and global resets and fonts were missing from every snapshot. Switch it off with `describeMe({ styledComponentsBrowserBuild: false })`.

  The reporter prints, and the viewer lists behind an "issues" chip, what could not be documented: anonymous components, components without props docs, missing assets.

  New public exports, nothing renamed or removed:

  - `@describe-me/core`: `describeComponentType()`, `manifestDiagnostics()` (also as `@describe-me/core/diagnostics`), the `RegisteredExport` and `ManifestDiagnostics` types, the `EXPORT_REGISTRY_KEY`, `ASSET_URL_PREFIX` and `ANONYMOUS_COMPONENT` constants, `ComponentInfo.file`, `TestRecord.origin` and `Manifest.assetsMissing`.
  - `@describe-me/vitest/plugin`: the `registerExports` and `styledComponentsBrowserBuild` options.

### Patch Changes

- Updated dependencies [[`5c032a3`](https://github.com/grzehub/describe-me/commit/5c032a383a575f35abf2f7df8b1135e743e31203)]:
  - @describe-me/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`3c63ec9`](https://github.com/grzehub/describe-me/commit/3c63ec9ae102b59c0262ebcc96552655bebc5742)]:
  - @describe-me/core@0.3.0

## 0.2.0

### Minor Changes

- [#14](https://github.com/grzehub/describe-me/pull/14) [`4b92a59`](https://github.com/grzehub/describe-me/commit/4b92a5918968dd8875f848c66d96dc337e0e547c) Thanks [@grzehub](https://github.com/grzehub)! - Reworked the viewer's look: the system UI sans as the default face and the mono
  face only for what is quoted from the codebase, a softer light and dark palette
  built on shared tokens, a quieter sidebar whose selection is a tinted row with an
  accent edge instead of a solid block, a module header that merges the test file
  and the single describe it holds into one row, a segmented viewport control, and
  a replay stage that sizes itself to what the snapshot actually paints instead of
  filling the panel.

### Patch Changes

- Updated dependencies []:
  - @describe-me/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`b5fbd45`](https://github.com/grzehub/describe-me/commit/b5fbd45aae1076b0db68adb57c3f256596a4a1e6)]:
  - @describe-me/core@0.1.1

## 0.1.0

### Minor Changes

- [#10](https://github.com/grzehub/describe-me/pull/10) [`92fb3ba`](https://github.com/grzehub/describe-me/commit/92fb3ba1a3fe58bd6cfa31a3ba8c879b1fa861be) Thanks [@grzehub](https://github.com/grzehub)! - First public release. Living component documentation generated from Vitest
  browser-mode tests: a recorder that captures a DOM frame after every render,
  interaction and `step()`, a Vitest plugin that wires it up in one line, a
  reporter that reads component props from TypeScript, and the `describe-me` CLI
  with a viewer (`dev`) and a static site build (`build`). React only for now.

### Patch Changes

- Updated dependencies [[`92fb3ba`](https://github.com/grzehub/describe-me/commit/92fb3ba1a3fe58bd6cfa31a3ba8c879b1fa861be)]:
  - @describe-me/core@0.1.0
