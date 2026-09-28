# @describe-me/react

## 0.5.0-next.1

### Patch Changes

- Updated dependencies [[`26d38dc`](https://github.com/grzehub/describe-me/commit/26d38dc3561436e5bf4b4c27b48de2be81eb1bae)]:
  - @describe-me/core@0.5.0-next.1

## 0.5.0-next.0

### Minor Changes

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

### Minor Changes

- [#16](https://github.com/grzehub/describe-me/pull/16) [`3c63ec9`](https://github.com/grzehub/describe-me/commit/3c63ec9ae102b59c0262ebcc96552655bebc5742) Thanks [@grzehub](https://github.com/grzehub)! - Record tests that run in jsdom, not only in browser mode. `describeMe()` detects the environment: without `test.browser.enabled` it redirects `@testing-library/react` to the recording adapter (including imports from your own `test-utils`), records a frame after every `@testing-library/user-event` call, turns on `test.css` and switches Testing Library's auto-cleanup off so the component is unmounted only after the closing frame. Override the detection with `describeMe({ environment: 'browser' | 'dom' })`.

  New public exports, nothing renamed or removed:

  - `@describe-me/react/testing-library` — synchronous drop-in `render` for `@testing-library/react`. `vitest-browser-react` and `@testing-library/react` are now both optional peers.
  - `@describe-me/vitest/setup-dom` — the jsdom setup file. `@testing-library/user-event` is a new optional peer.
  - `@describe-me/vitest/plugin` — the `environment` option and the `DescribeMeEnvironment` type.
  - `@describe-me/core` — `recorder.capture()` takes `{ settle: false }` to snapshot synchronously, `recorder.onTeardown()` / `recorder.teardown()`, and the `CaptureOptions` type.

  The plugin now fails with a clear error when the recording adapter cannot be resolved, instead of silently falling back to the original `render`.

### Patch Changes

- Updated dependencies [[`3c63ec9`](https://github.com/grzehub/describe-me/commit/3c63ec9ae102b59c0262ebcc96552655bebc5742)]:
  - @describe-me/core@0.3.0

## 0.2.0

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
