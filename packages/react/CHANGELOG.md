# @describe-me/react

## 0.5.2

### Patch Changes

- Updated dependencies [[`de9aad9`](https://github.com/grzehub/describe-me/commit/de9aad9c5070af81a22e9e3119c6b2712093bb40), [`effa0e6`](https://github.com/grzehub/describe-me/commit/effa0e6c90fe85f490a71321189257de1ae4fc74), [`efcd9e9`](https://github.com/grzehub/describe-me/commit/efcd9e9f052ecaee2bf4298b415b3053399c1fcd), [`460d699`](https://github.com/grzehub/describe-me/commit/460d6995fd1d44d9b75e45b53857867bf83ad8d8)]:
  - @describe-me/core@0.5.2
  - @describe-me/vitest@0.5.2

## 0.5.1

### Patch Changes

- [#49](https://github.com/grzehub/describe-me/pull/49) [`2130974`](https://github.com/grzehub/describe-me/commit/2130974e4a926bd8470c90fb8d0e413c009b57b0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Docs.

  - **One version for every describe-me package.** Each package README says to install and upgrade them together.
  - **`describe-me build` and the network.** The viewer README names the font hosts `build` contacts, what an unreachable host costs, and how `--no-vendor-fonts` keeps the build offline.

  No code or API changes.

- [#42](https://github.com/grzehub/describe-me/pull/42) [`75e9837`](https://github.com/grzehub/describe-me/commit/75e983729c68dd157619f1c7ab7601b70612bdd9) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - A guard against mixed describe-me versions in one project.

  - **A clear error instead of `is not a function`** (`@describe-me/core`). The shared test recorder carries a protocol number, `recorder.protocol`. When a copy of `@describe-me/core` finds a recorder that a copy with another protocol created, importing it throws "describe-me: all describe-me packages must be on the same version…". A recorder created by 0.5.0 is accepted. One created by 0.4 is not, so `@describe-me/react` 0.5.1 with `@describe-me/vitest` 0.4 fails every test file with that message.
  - **The manifest names its writer** (`@describe-me/core`, `@describe-me/vitest`). `manifest.json` gets `generator: { name, version }`, the reporter package and its version. The type is `Manifest.generator?: ManifestGenerator`, absent in manifests written before 0.5.1.
  - **The viewer warns about data from another version** (`describe-me`). A banner under the header names both versions when their major.minor differs. Data without `generator` shows no banner, because this viewer reads everything written before 0.5.1.
  - **Peer dependencies between the packages** (`@describe-me/react`, `@describe-me/vitest`). `@describe-me/react` peers on `@describe-me/vitest`, and `@describe-me/vitest` has an optional peer on `describe-me`. Both ranges start at this release (`^0.5.1`), so the package manager reports a mix at install time.

  Added: the `ManifestGenerator` type (`@describe-me/core`, `@describe-me/core/types`) and the read-only `recorder.protocol`. Nothing removed or renamed.

- Updated dependencies [[`2130974`](https://github.com/grzehub/describe-me/commit/2130974e4a926bd8470c90fb8d0e413c009b57b0), [`43d8a2e`](https://github.com/grzehub/describe-me/commit/43d8a2e43178be0639b905fd91591ef6b3d30c76), [`63a2761`](https://github.com/grzehub/describe-me/commit/63a27619480ec413e88c95c3cc54e2ba987ea221), [`75e9837`](https://github.com/grzehub/describe-me/commit/75e983729c68dd157619f1c7ab7601b70612bdd9)]:
  - @describe-me/core@0.5.1
  - @describe-me/vitest@0.5.1

## 0.5.0

### Minor Changes

- [#36](https://github.com/grzehub/describe-me/pull/36) [`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Component naming: a test whose root element is a provider, a fragment, `Suspense`, a host element or a component defined in the test file is documented under the first project component it renders.

  - **How the name is found** (`@describe-me/react`, both entry points). A root the plugin registered keeps its name. Otherwise `render` and `rerender` look for the first registered component among the root's `children` and other element props (never `fallback`), then in the tree React mounted under the root element, skipping `Suspense` fallbacks. With a `wrapper`, the wrapper's own components are never picked. When nothing is found, or React internals are missing, the root keeps its own name. The lookup is synchronous and bounded, and registered roots skip it.
  - **Props come from that component.** `ComponentInfo.props` and the render frame's `meta.props` hold the props the named component received, not the root element's. Props coverage and the render frame label follow, for example `<Badge tone="danger" />` instead of `<ThemeProvider />`. Tests that showed `ThemeProvider`, another provider or `Anonymous` move to the component they render.
  - **`rerender` names the component too.** A test that starts with `render(<></>)` and rerenders a component is documented under that component.
  - **`recorder.setComponent()` can replace a weak name** (`@describe-me/core`, also exported by `@describe-me/vitest`). It replaces `Anonymous` with a named component, and a component without `file` with one that has a `file`. Otherwise the first call in a test still wins. For a `wrapper` that ignores `children`, call `recorder.setComponent({ name, props })` after `render`.

  No exports added or removed.

- [#30](https://github.com/grzehub/describe-me/pull/30) [`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Render frame timing: an opt-in `renderFrame` option takes the render frame once async content has loaded, and frames keep the order the test asked for them.

  - **New plugin option `renderFrame`** (`@describe-me/vitest/plugin`): `'eager'` (default, unchanged), `'lazy'` or `{ pending: string, timeout?: number }`. `'lazy'` takes the render frame right before the test's next interaction (a user event, `step()`, `fireEvent`, `render`, `rerender`, `unmount` or `cleanup`), or at the end of the test. `{ pending }` takes it as soon as nothing matches the CSS selector and the page shows content, and falls back to `'lazy'` after `timeout` ms (default 2000). Every render frame follows it, `rerender` included. The plugin rejects any other value before tests run, and an invalid selector fails when the setup file loads.
  - **Frames keep call order.** A frame sits where its capture was called, not where it finished. A capture still running when its test ends is dropped, so an interaction or `step()` the test did not await no longer lands in the next test or hides its first action. `at` is still the time the snapshot was taken.
  - **New recorder methods** (`@describe-me/core`, also through `@describe-me/vitest`). `recorder.configure({ renderFrame })` is called by the setup files with the plugin's option. Without the plugin, call it in your own setup file, listed after describe-me's. `recorder.beforeInteraction()` takes a deferred render frame now, for adapters. `recorder.flush()` waits for captures in flight, takes a deferred render frame and resolves to whether it took one. `recorder.generation` identifies the current test.
  - **New types** (`@describe-me/core`): `RenderFrameMode` and `RecorderOptions`, and the field `CaptureOptions.generation`. Pass `recorder.generation` as read when an interaction began, and a capture from an earlier test is dropped.
  - The `'describe-me'` key on Vitest's `ProvidedContext` gains `renderFrame`.
  - `@describe-me/react`: `render`, `rerender`, `unmount`, `fireEvent` and `cleanup` take a deferred render frame before they change the page. Signatures are unchanged.

  No exports removed. With the default `'eager'`, a test that awaits its interactions records the same frames as before.

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

- Updated dependencies [[`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0), [`993012b`](https://github.com/grzehub/describe-me/commit/993012babf8dc61727198729111619f8a5a5562f), [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe), [`26d38dc`](https://github.com/grzehub/describe-me/commit/26d38dc3561436e5bf4b4c27b48de2be81eb1bae), [`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7), [`48cbc2a`](https://github.com/grzehub/describe-me/commit/48cbc2ab5071494328a252659a1514c914fa5ad5), [`c877e0e`](https://github.com/grzehub/describe-me/commit/c877e0edddf20805814b3872088ad68272de8b1a), [`9cc05eb`](https://github.com/grzehub/describe-me/commit/9cc05eb64a9490916596129c27bebb0afbc3318a), [`ad824ba`](https://github.com/grzehub/describe-me/commit/ad824ba91f52a4d442b1106c6fae01e5b3747af2)]:
  - @describe-me/core@0.5.0

## 0.5.0-next.3

### Minor Changes

- [#36](https://github.com/grzehub/describe-me/pull/36) [`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0) Thanks [@grzehub-bot](https://github.com/grzehub-bot)! - Component naming: a test whose root element is a provider, a fragment, `Suspense`, a host element or a component defined in the test file is documented under the first project component it renders.

  - **How the name is found** (`@describe-me/react`, both entry points). A root the plugin registered keeps its name. Otherwise `render` and `rerender` look for the first registered component among the root's `children` and other element props (never `fallback`), then in the tree React mounted under the root element, skipping `Suspense` fallbacks. With a `wrapper`, the wrapper's own components are never picked. When nothing is found, or React internals are missing, the root keeps its own name. The lookup is synchronous and bounded, and registered roots skip it.
  - **Props come from that component.** `ComponentInfo.props` and the render frame's `meta.props` hold the props the named component received, not the root element's. Props coverage and the render frame label follow, for example `<Badge tone="danger" />` instead of `<ThemeProvider />`. Tests that showed `ThemeProvider`, another provider or `Anonymous` move to the component they render.
  - **`rerender` names the component too.** A test that starts with `render(<></>)` and rerenders a component is documented under that component.
  - **`recorder.setComponent()` can replace a weak name** (`@describe-me/core`, also exported by `@describe-me/vitest`). It replaces `Anonymous` with a named component, and a component without `file` with one that has a `file`. Otherwise the first call in a test still wins. For a `wrapper` that ignores `children`, call `recorder.setComponent({ name, props })` after `render`.

  No exports added or removed.

### Patch Changes

- Updated dependencies [[`ea1f5ea`](https://github.com/grzehub/describe-me/commit/ea1f5ead71b78e0a736b06a34637576b2f215be0), [`fae43ef`](https://github.com/grzehub/describe-me/commit/fae43ef9e1780091839ff4d968435b3d436bebfe), [`ad824ba`](https://github.com/grzehub/describe-me/commit/ad824ba91f52a4d442b1106c6fae01e5b3747af2)]:
  - @describe-me/core@0.5.0-next.3

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

### Patch Changes

- Updated dependencies [[`c0cadfd`](https://github.com/grzehub/describe-me/commit/c0cadfd0f0c3072b4fa6bfc534e34b65d5e159d7)]:
  - @describe-me/core@0.5.0-next.2

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
