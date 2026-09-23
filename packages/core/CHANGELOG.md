# @describe-me/core

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
