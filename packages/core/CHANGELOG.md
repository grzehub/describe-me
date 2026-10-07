# @describe-me/core

## 0.5.4

### Patch Changes

- [#66](https://github.com/grzehub/describe-me/pull/66) [`1b27eca`](https://github.com/grzehub/describe-me/commit/1b27ecac9d21d5a3940bd7027139282f56665e4b) Thanks [@grzehub](https://github.com/grzehub)! - The package pages on npm point at the docs site. Every README opens with a link to the docs and the two live example viewers, explains which package you need, and shares one quick start. The details moved to the docs pages they link. The package descriptions and keywords are aligned, and `visual testing` is gone from the keywords because describe-me does no visual regression testing.

## 0.5.3

No changes in this release.

## 0.5.2

### Patch Changes

- [#53](https://github.com/grzehub/describe-me/pull/53) [`de9aad9`](https://github.com/grzehub/describe-me/commit/de9aad9c5070af81a22e9e3119c6b2712093bb40) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Recording no longer adds React act warnings in jsdom.

  - **The recorder waits with React's act flag off** (`@describe-me/vitest`). After each interaction or step, and before a deferred render frame or the closing frame, the recorder waits one macrotask for the page to settle. `setup-dom` turns `IS_REACT_ACT_ENVIRONMENT` off for that wait and restores it afterwards, as Testing Library's async utilities do. An update that landed in the wait used to log an act warning that a run without describe-me never showed. Browser mode is unchanged.
  - **`RecorderOptions.aroundWait`** (`@describe-me/core`). An optional function that runs each wait of the recorder, passed to `recorder.configure()`. A later `configure()` without it keeps the current one. Its type is exported as `AroundWait`.
  - **Recorder protocol 2.** A copy of `@describe-me/core` from 0.5.1 or earlier next to these packages fails with "all describe-me packages must be on the same version" instead of silently losing the fix.

## 0.5.1

### Patch Changes

- [#49](https://github.com/grzehub/describe-me/pull/49) [`2130974`](https://github.com/grzehub/describe-me/commit/2130974e4a926bd8470c90fb8d0e413c009b57b0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Docs.

  - **One version for every describe-me package.** Each package README says to install and upgrade them together.
  - **`describe-me build` and the network.** The viewer README names the font hosts `build` contacts, what an unreachable host costs, and how `--no-vendor-fonts` keeps the build offline.

  No code or API changes.

- [#47](https://github.com/grzehub/describe-me/pull/47) [`43d8a2e`](https://github.com/grzehub/describe-me/commit/43d8a2e43178be0639b905fd91591ef6b3d30c76) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - One mistake no longer breaks a whole test run.

  - **A `renderFrame.pending` selector the test environment cannot parse falls back to `'lazy'`** (`@describe-me/core`). Every test file used to fail at setup. The recorder warns once per test file and takes render frames as with `renderFrame: 'lazy'`.
  - **Garbage collection leaves folders alone** (`@describe-me/vitest`). A folder inside `.describe-me/snapshots`, `styles` or `assets` stopped the reporter before it wrote `manifest.json`. Stray files are still deleted.

  No exports change.

- [#45](https://github.com/grzehub/describe-me/pull/45) [`63a2761`](https://github.com/grzehub/describe-me/commit/63a27619480ec413e88c95c3cc54e2ba987ea221) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - In jsdom, styled-components 6.0 to 6.3 no longer fail to load under Vite 6 and 7. These versions import tslib, and the optimizer bundled tslib's UMD file without its default export, so every test that imported styled-components failed with `Cannot destructure property '__extends' of 'import_tslib.default'`. The plugin points `tslib` at the `tslib.es6.mjs` that styled-components resolves. A `tslib` alias in your own `vitest.config.ts` is no longer needed.

  When that tslib is older than 2.5.3 and has no `tslib.es6.mjs` (styled-components 6.1.3 to 6.1.9 pin 2.5.0), the plugin leaves tslib alone and warns after the run: upgrade styled-components to 6.1.10 or later, or override tslib to 2.5.3 or later. The viewer lists the same warning behind its issues chip.

  Public API:

  - `@describe-me/core/types`: `Manifest.setupWarnings` and `ManifestDiagnostics.setupWarnings`. The second is a required member, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add it.
  - `@describe-me/vitest/reporter`: the `setupWarnings` option of `DescribeMeReporterOptions`.

  No existing export is renamed or removed.

- [#42](https://github.com/grzehub/describe-me/pull/42) [`75e9837`](https://github.com/grzehub/describe-me/commit/75e983729c68dd157619f1c7ab7601b70612bdd9) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - A guard against mixed describe-me versions in one project.

  - **A clear error instead of `is not a function`** (`@describe-me/core`). The shared test recorder carries a protocol number, `recorder.protocol`. When a copy of `@describe-me/core` finds a recorder that a copy with another protocol created, importing it throws "describe-me: all describe-me packages must be on the same version…". A recorder created by 0.5.0 is accepted. One created by 0.4 is not, so `@describe-me/react` 0.5.1 with `@describe-me/vitest` 0.4 fails every test file with that message.
  - **The manifest names its writer** (`@describe-me/core`, `@describe-me/vitest`). `manifest.json` gets `generator: { name, version }`, the reporter package and its version. The type is `Manifest.generator?: ManifestGenerator`, absent in manifests written before 0.5.1.
  - **The viewer warns about data from another version** (`describe-me`). A banner under the header names both versions when their major.minor differs. Data without `generator` shows no banner, because this viewer reads everything written before 0.5.1.
  - **Peer dependencies between the packages** (`@describe-me/react`, `@describe-me/vitest`). `@describe-me/react` peers on `@describe-me/vitest`, and `@describe-me/vitest` has an optional peer on `describe-me`. Both ranges start at this release (`^0.5.1`), so the package manager reports a mix at install time.

  Added: the `ManifestGenerator` type (`@describe-me/core`, `@describe-me/core/types`) and the read-only `recorder.protocol`. Nothing removed or renamed.

## 0.5.0

### Minor Changes

- [#36](https://github.com/grzehub/describe-me/pull/36) [`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Component naming: a test whose root element is a provider, a fragment, `Suspense`, a host element or a component defined in the test file is documented under the first project component it renders.

  - **How the name is found** (`@describe-me/react`, both entry points). A root the plugin registered keeps its name. Otherwise `render` and `rerender` look for the first registered component among the root's `children` and other element props (never `fallback`), then in the tree React mounted under the root element, skipping `Suspense` fallbacks. With a `wrapper`, the wrapper's own components are never picked. When nothing is found, or React internals are missing, the root keeps its own name. The lookup is synchronous and bounded, and registered roots skip it.
  - **Props come from that component.** `ComponentInfo.props` and the render frame's `meta.props` hold the props the named component received, not the root element's. Props coverage and the render frame label follow, for example `<Badge tone="danger" />` instead of `<ThemeProvider />`. Tests that showed `ThemeProvider`, another provider or `Anonymous` move to the component they render.
  - **`rerender` names the component too.** A test that starts with `render(<></>)` and rerenders a component is documented under that component.
  - **`recorder.setComponent()` can replace a weak name** (`@describe-me/core`, also exported by `@describe-me/vitest`). It replaces `Anonymous` with a named component, and a component without `file` with one that has a `file`. Otherwise the first call in a test still wins. For a `wrapper` that ignores `children`, call `recorder.setComponent({ name, props })` after `render`.

  No exports added or removed.

- [#21](https://github.com/grzehub/describe-me/pull/21) [`993012b`](https://github.com/grzehub/describe-me/commit/993012babf8dc61727198729111619f8a5a5562f) Thanks [@grzehub](https://github.com/grzehub)! - Deterministic snapshots: identical DOM is now stored once.

  - rrweb node ids restart at 1 for every capture and `rootId` is gone, so two captures of the same DOM serialize to the same text and share one file in `snapshots/`. Snapshot file names change: the first full run after upgrading rewrites them and garbage-collects the old ones.
  - **Type change (`@describe-me/core`):** `Frame.snapshot` is now `string` (the rrweb serialized document as JSON text) instead of `unknown`, so code reading `task.meta.describeMe` directly gets a string per frame. The reporter still accepts object snapshots from an older core; upgrade all `@describe-me/*` packages together.
  - Frames are compared by their exact serialized text. A change to an element's HTML `id` attribute now counts as a change (it used to be ignored).
  - `recorder.capture(..., { settle: false })` takes the snapshot and records the frame before it returns.

  No exports added or removed.

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

- [#30](https://github.com/grzehub/describe-me/pull/30) [`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Render frame timing: an opt-in `renderFrame` option takes the render frame once async content has loaded, and frames keep the order the test asked for them.

  - **New plugin option `renderFrame`** (`@describe-me/vitest/plugin`): `'eager'` (default, unchanged), `'lazy'` or `{ pending: string, timeout?: number }`. `'lazy'` takes the render frame right before the test's next interaction (a user event, `step()`, `fireEvent`, `render`, `rerender`, `unmount` or `cleanup`), or at the end of the test. `{ pending }` takes it as soon as nothing matches the CSS selector and the page shows content, and falls back to `'lazy'` after `timeout` ms (default 2000). Every render frame follows it, `rerender` included. The plugin rejects any other value before tests run, and an invalid selector fails when the setup file loads.
  - **Frames keep call order.** A frame sits where its capture was called, not where it finished. A capture still running when its test ends is dropped, so an interaction or `step()` the test did not await no longer lands in the next test or hides its first action. `at` is still the time the snapshot was taken.
  - **New recorder methods** (`@describe-me/core`, also through `@describe-me/vitest`). `recorder.configure({ renderFrame })` is called by the setup files with the plugin's option. Without the plugin, call it in your own setup file, listed after describe-me's. `recorder.beforeInteraction()` takes a deferred render frame now, for adapters. `recorder.flush()` waits for captures in flight, takes a deferred render frame and resolves to whether it took one. `recorder.generation` identifies the current test.
  - **New types** (`@describe-me/core`): `RenderFrameMode` and `RecorderOptions`, and the field `CaptureOptions.generation`. Pass `recorder.generation` as read when an interaction began, and a capture from an earlier test is dropped.
  - The `'describe-me'` key on Vitest's `ProvidedContext` gains `renderFrame`.
  - `@describe-me/react`: `render`, `rerender`, `unmount`, `fireEvent` and `cleanup` take a deferred render frame before they change the page. Signatures are unchanged.

  No exports removed. With the default `'eager'`, a test that awaits its interactions records the same frames as before.

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

- [#27](https://github.com/grzehub/describe-me/pull/27) [`9cc05eb`](https://github.com/grzehub/describe-me/commit/9cc05eb64a9490916596129c27bebb0afbc3318a) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Testing Library adapter fixes: `fireEvent` records frames, `afterEach(cleanup)` and fake timers no longer spoil the closing frame, and `renderHook` files are unmounted.

  - **`fireEvent` records a frame** (`@describe-me/react/testing-library`). The function and every method (`fireEvent.click`, `fireEvent.change`, …) are recording wrappers with the same signatures. One call is one frame, labelled like `click(button "Save")` or `change(text "Name", "hello")`. Only `fireEvent` from `@testing-library/react` is covered.
  - **`cleanup` takes the closing frame before it unmounts** (`@describe-me/react/testing-library`). `afterEach(cleanup)` in a test file no longer records an empty page. Called in the middle of a test, it leaves a `before cleanup()` step once the test records again.
  - **`renderHook` files are unmounted.** The adapter registers its unmount when it is imported, not on the first `render`, so a file that only uses `renderHook` no longer leaves trees mounted. `renderHook` still records no frames.
  - **No empty closing frames.** The closing frame is skipped when the page shows nothing, for example after `unmount()`.
  - **Fake timers are safe.** The recorder keeps the real `setTimeout` and `performance`, so `vi.useFakeTimers()` left on no longer hangs a `step()` or the closing frame until the timeout, and frame times stay real.
  - **Act warnings are back** (`@describe-me/vitest/setup-dom`). Switching off Testing Library's auto-cleanup also skipped its `IS_REACT_ACT_ENVIRONMENT` setup, which silenced React's "not wrapped in act(...)" warnings. The setup file sets the flag under Testing Library's own conditions (Vitest globals). The warnings you see are the ones you get without describe-me. This is not a regression.
  - **`@testing-library/user-event` is really optional.** The DOM setup file loads it dynamically and skips the patch when it is missing.
  - **The render redirect finds the adapter by its installed path.** Test files under a `packages/react/` directory of your own repository are now redirected and recorded.
  - **New export `elementLabel`** (`@describe-me/core`) names a DOM element for a frame label, e.g. `button "Save"`. It moved from `@describe-me/vitest`, where it was internal.

  No exports removed. `cleanup` and `fireEvent` keep their names and signatures.

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

## 0.5.0-next.3

### Minor Changes

- [#36](https://github.com/grzehub/describe-me/pull/36) [`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Component naming: a test whose root element is a provider, a fragment, `Suspense`, a host element or a component defined in the test file is documented under the first project component it renders.

  - **How the name is found** (`@describe-me/react`, both entry points). A root the plugin registered keeps its name. Otherwise `render` and `rerender` look for the first registered component among the root's `children` and other element props (never `fallback`), then in the tree React mounted under the root element, skipping `Suspense` fallbacks. With a `wrapper`, the wrapper's own components are never picked. When nothing is found, or React internals are missing, the root keeps its own name. The lookup is synchronous and bounded, and registered roots skip it.
  - **Props come from that component.** `ComponentInfo.props` and the render frame's `meta.props` hold the props the named component received, not the root element's. Props coverage and the render frame label follow, for example `<Badge tone="danger" />` instead of `<ThemeProvider />`. Tests that showed `ThemeProvider`, another provider or `Anonymous` move to the component they render.
  - **`rerender` names the component too.** A test that starts with `render(<></>)` and rerenders a component is documented under that component.
  - **`recorder.setComponent()` can replace a weak name** (`@describe-me/core`, also exported by `@describe-me/vitest`). It replaces `Anonymous` with a named component, and a component without `file` with one that has a `file`. Otherwise the first call in a test still wins. For a `wrapper` that ignores `children`, call `recorder.setComponent({ name, props })` after `render`.

  No exports added or removed.

- [#33](https://github.com/grzehub/describe-me/pull/33) [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - The reporter lists the font families that frames use but nothing loads, and the hosts that frames load stylesheets from.

  - **New manifest fields** `Manifest.fontsMissing` (`FontMissing[]` with `family`, `tests` and `testId`, the first test that misses it) and `Manifest.remoteStylesheets` (`RemoteStylesheet[]` with `host` and `frames`). Both types are exported from `@describe-me/core` and `@describe-me/core/types`. Manifests written before this version do not have them, which counts as empty.
  - **`ManifestDiagnostics` has two new required members**, `fontsMissing` and `remoteStylesheets`, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add them.
  - A family counts as missing when it is the first family of a `font-family` or `font` declaration, with `var()` followed, and it is neither a generic or system family nor loaded by an `@font-face` rule, Google Fonts, Bunny Fonts or Fontsource on jsDelivr, in the frame or in the preview head. A stylesheet from any other host turns the check off for that frame, or for every frame when the preview head links it. So Adobe Fonts and custom CDNs never cause false alarms.
  - The reporter prints one warning line for each list. The viewer's issues chip shows both, and each missing family links to its first test.

  No existing export is renamed or removed.

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

## 0.5.0-next.2

### Minor Changes

- [#30](https://github.com/grzehub/describe-me/pull/30) [`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Render frame timing: an opt-in `renderFrame` option takes the render frame once async content has loaded, and frames keep the order the test asked for them.

  - **New plugin option `renderFrame`** (`@describe-me/vitest/plugin`): `'eager'` (default, unchanged), `'lazy'` or `{ pending: string, timeout?: number }`. `'lazy'` takes the render frame right before the test's next interaction (a user event, `step()`, `fireEvent`, `render`, `rerender`, `unmount` or `cleanup`), or at the end of the test. `{ pending }` takes it as soon as nothing matches the CSS selector and the page shows content, and falls back to `'lazy'` after `timeout` ms (default 2000). Every render frame follows it, `rerender` included. The plugin rejects any other value before tests run, and an invalid selector fails when the setup file loads.
  - **Frames keep call order.** A frame sits where its capture was called, not where it finished. A capture still running when its test ends is dropped, so an interaction or `step()` the test did not await no longer lands in the next test or hides its first action. `at` is still the time the snapshot was taken.
  - **New recorder methods** (`@describe-me/core`, also through `@describe-me/vitest`). `recorder.configure({ renderFrame })` is called by the setup files with the plugin's option. Without the plugin, call it in your own setup file, listed after describe-me's. `recorder.beforeInteraction()` takes a deferred render frame now, for adapters. `recorder.flush()` waits for captures in flight, takes a deferred render frame and resolves to whether it took one. `recorder.generation` identifies the current test.
  - **New types** (`@describe-me/core`): `RenderFrameMode` and `RecorderOptions`, and the field `CaptureOptions.generation`. Pass `recorder.generation` as read when an interaction began, and a capture from an earlier test is dropped.
  - The `'describe-me'` key on Vitest's `ProvidedContext` gains `renderFrame`.
  - `@describe-me/react`: `render`, `rerender`, `unmount`, `fireEvent` and `cleanup` take a deferred render frame before they change the page. Signatures are unchanged.

  No exports removed. With the default `'eager'`, a test that awaits its interactions records the same frames as before.

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

## 0.5.0-next.0

### Minor Changes

- [#21](https://github.com/grzehub/describe-me/pull/21) [`993012b`](https://github.com/grzehub/describe-me/commit/993012babf8dc61727198729111619f8a5a5562f) Thanks [@grzehub](https://github.com/grzehub)! - Deterministic snapshots: identical DOM is now stored once.

  - rrweb node ids restart at 1 for every capture and `rootId` is gone, so two captures of the same DOM serialize to the same text and share one file in `snapshots/`. Snapshot file names change: the first full run after upgrading rewrites them and garbage-collects the old ones.
  - **Type change (`@describe-me/core`):** `Frame.snapshot` is now `string` (the rrweb serialized document as JSON text) instead of `unknown`, so code reading `task.meta.describeMe` directly gets a string per frame. The reporter still accepts object snapshots from an older core; upgrade all `@describe-me/*` packages together.
  - Frames are compared by their exact serialized text. A change to an element's HTML `id` attribute now counts as a change (it used to be ignored).
  - `recorder.capture(..., { settle: false })` takes the snapshot and records the frame before it returns.

  No exports added or removed.

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

- [#27](https://github.com/grzehub/describe-me/pull/27) [`9cc05eb`](https://github.com/grzehub/describe-me/commit/9cc05eb64a9490916596129c27bebb0afbc3318a) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Testing Library adapter fixes: `fireEvent` records frames, `afterEach(cleanup)` and fake timers no longer spoil the closing frame, and `renderHook` files are unmounted.

  - **`fireEvent` records a frame** (`@describe-me/react/testing-library`). The function and every method (`fireEvent.click`, `fireEvent.change`, …) are recording wrappers with the same signatures. One call is one frame, labelled like `click(button "Save")` or `change(text "Name", "hello")`. Only `fireEvent` from `@testing-library/react` is covered.
  - **`cleanup` takes the closing frame before it unmounts** (`@describe-me/react/testing-library`). `afterEach(cleanup)` in a test file no longer records an empty page. Called in the middle of a test, it leaves a `before cleanup()` step once the test records again.
  - **`renderHook` files are unmounted.** The adapter registers its unmount when it is imported, not on the first `render`, so a file that only uses `renderHook` no longer leaves trees mounted. `renderHook` still records no frames.
  - **No empty closing frames.** The closing frame is skipped when the page shows nothing, for example after `unmount()`.
  - **Fake timers are safe.** The recorder keeps the real `setTimeout` and `performance`, so `vi.useFakeTimers()` left on no longer hangs a `step()` or the closing frame until the timeout, and frame times stay real.
  - **Act warnings are back** (`@describe-me/vitest/setup-dom`). Switching off Testing Library's auto-cleanup also skipped its `IS_REACT_ACT_ENVIRONMENT` setup, which silenced React's "not wrapped in act(...)" warnings. The setup file sets the flag under Testing Library's own conditions (Vitest globals). The warnings you see are the ones you get without describe-me. This is not a regression.
  - **`@testing-library/user-event` is really optional.** The DOM setup file loads it dynamically and skips the patch when it is missing.
  - **The render redirect finds the adapter by its installed path.** Test files under a `packages/react/` directory of your own repository are now redirected and recorded.
  - **New export `elementLabel`** (`@describe-me/core`) names a DOM element for a frame label, e.g. `button "Save"`. It moved from `@describe-me/vitest`, where it was internal.

  No exports removed. `cleanup` and `fireEvent` keep their names and signatures.

## 0.4.0

### Minor Changes

- [#18](https://github.com/grzehub/describe-me/pull/18) [`5c032a3`](https://github.com/grzehub/describe-me/commit/5c032a383a575f35abf2f7df8b1135e743e31203) Thanks [@grzehub](https://github.com/grzehub)! - Components are named after their export. An anonymous `forwardRef`, a `memo(forwardRef(…))` or a styled component exported as `Text` used to be recorded as `Anonymous` or `styled.p`, which left it out of the component overview. The plugin now appends a few lines to every project module (not tests, not node_modules) that register its top-level exports on `globalThis`; the adapter names a component after its export and records the file that defines it, and the reporter reads its props from that file. Props are also read through `forwardRef(…)` and `memo(…)` (defaults included), from generic polymorphic components and from styled-components 6. Switch it off with `describeMe({ registerExports: false })`.

  Project assets (images, videos, local fonts, CSS `url()`s) are copied into `.describe-me/assets/` and load in `describe-me dev` and in the static build, instead of pointing at the test page's origin (`http://localhost:3000` in jsdom), which is gone once the tests end. Paths that cannot be found are listed in `manifest.assetsMissing`.

  In jsdom, styled-components (5 and later) is loaded from its browser build, together with jest-styled-components, because the Node build's `createGlobalStyle` never inserts its CSS on the client and global resets and fonts were missing from every snapshot. Switch it off with `describeMe({ styledComponentsBrowserBuild: false })`.

  The reporter prints, and the viewer lists behind an "issues" chip, what could not be documented: anonymous components, components without props docs, missing assets.

  New public exports, nothing renamed or removed:

  - `@describe-me/core`: `describeComponentType()`, `manifestDiagnostics()` (also as `@describe-me/core/diagnostics`), the `RegisteredExport` and `ManifestDiagnostics` types, the `EXPORT_REGISTRY_KEY`, `ASSET_URL_PREFIX` and `ANONYMOUS_COMPONENT` constants, `ComponentInfo.file`, `TestRecord.origin` and `Manifest.assetsMissing`.
  - `@describe-me/vitest/plugin`: the `registerExports` and `styledComponentsBrowserBuild` options.

## 0.3.0

### Minor Changes

- [#16](https://github.com/grzehub/describe-me/pull/16) [`3c63ec9`](https://github.com/grzehub/describe-me/commit/3c63ec9ae102b59c0262ebcc96552655bebc5742) Thanks [@grzehub](https://github.com/grzehub)! - Record tests that run in jsdom, not only in browser mode. `describeMe()` detects the environment: without `test.browser.enabled` it redirects `@testing-library/react` to the recording adapter (including imports from your own `test-utils`), records a frame after every `@testing-library/user-event` call, turns on `test.css` and switches Testing Library's auto-cleanup off so the component is unmounted only after the closing frame. Override the detection with `describeMe({ environment: 'browser' | 'dom' })`.

  New public exports, nothing renamed or removed:

  - `@describe-me/react/testing-library` — synchronous drop-in `render` for `@testing-library/react`. `vitest-browser-react` and `@testing-library/react` are now both optional peers.
  - `@describe-me/vitest/setup-dom` — the jsdom setup file. `@testing-library/user-event` is a new optional peer.
  - `@describe-me/vitest/plugin` — the `environment` option and the `DescribeMeEnvironment` type.
  - `@describe-me/core` — `recorder.capture()` takes `{ settle: false }` to snapshot synchronously, `recorder.onTeardown()` / `recorder.teardown()`, and the `CaptureOptions` type.

  The plugin now fails with a clear error when the recording adapter cannot be resolved, instead of silently falling back to the original `render`.

## 0.2.0

No changes in this release.

## 0.1.1

### Patch Changes

- [#12](https://github.com/grzehub/describe-me/pull/12) [`b5fbd45`](https://github.com/grzehub/describe-me/commit/b5fbd45aae1076b0db68adb57c3f256596a4a1e6) Thanks [@grzehub](https://github.com/grzehub)! - Fix render frames going missing when the adapter and the setup file receive
  two copies of `@describe-me/core` (Vite pre-bundles the adapter with its own
  copy while a linked workspace serves the setup file from source). The recorder
  is now a single instance per page, anchored on `globalThis`.

## 0.1.0

### Minor Changes

- [#10](https://github.com/grzehub/describe-me/pull/10) [`92fb3ba`](https://github.com/grzehub/describe-me/commit/92fb3ba1a3fe58bd6cfa31a3ba8c879b1fa861be) Thanks [@grzehub](https://github.com/grzehub)! - First public release. Living component documentation generated from Vitest
  browser-mode tests: a recorder that captures a DOM frame after every render,
  interaction and `step()`, a Vitest plugin that wires it up in one line, a
  reporter that reads component props from TypeScript, and the `describe-me` CLI
  with a viewer (`dev`) and a static site build (`build`). React only for now.
