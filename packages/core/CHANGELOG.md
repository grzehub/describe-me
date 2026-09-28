# @describe-me/core

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
