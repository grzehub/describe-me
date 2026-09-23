---
'@describe-me/core': minor
'@describe-me/react': minor
'@describe-me/vitest': minor
---

Record tests that run in jsdom, not only in browser mode. `describeMe()` detects the environment: without `test.browser.enabled` it redirects `@testing-library/react` to the recording adapter (including imports from your own `test-utils`), records a frame after every `@testing-library/user-event` call, turns on `test.css` and switches Testing Library's auto-cleanup off so the component is unmounted only after the closing frame. Override the detection with `describeMe({ environment: 'browser' | 'dom' })`.

New public exports, nothing renamed or removed:

- `@describe-me/react/testing-library` — synchronous drop-in `render` for `@testing-library/react`. `vitest-browser-react` and `@testing-library/react` are now both optional peers.
- `@describe-me/vitest/setup-dom` — the jsdom setup file. `@testing-library/user-event` is a new optional peer.
- `@describe-me/vitest/plugin` — the `environment` option and the `DescribeMeEnvironment` type.
- `@describe-me/core` — `recorder.capture()` takes `{ settle: false }` to snapshot synchronously, `recorder.onTeardown()` / `recorder.teardown()`, and the `CaptureOptions` type.

The plugin now fails with a clear error when the recording adapter cannot be resolved, instead of silently falling back to the original `render`.
