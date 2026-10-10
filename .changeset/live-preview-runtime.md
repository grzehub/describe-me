---
'@describe-me/core': minor
'@describe-me/vitest': minor
'@describe-me/react': minor
---

Live preview runtime. `createLiveServer({ root, configFile?, port? })` from the new `@describe-me/vitest/live` starts a second Vite dev server on the project's own Vitest config. Its page imports one test file in the browser, with `vitest`, the render modules, `vitest/browser` and `@describe-me/vitest` swapped for shims. It runs the test's `beforeAll` and `beforeEach` hooks and its body, and stops at the first render. The component stays mounted and live, and nothing after the render runs.

- New entry points, used by the live preview and not for import in tests: `@describe-me/core/live`, `@describe-me/vitest/live-runtime`, `@describe-me/react/live` and `@describe-me/react/live-testing-library`.
- `@describe-me/core/types` adds `LiveStatus`, `LiveReport`, `LiveMessage`, `LIVE_MESSAGE_SOURCE` and `LIVE_PROTOCOL`.
- `describeMe()` exposes `api.live.protocol`. While `createLiveServer()` loads the config, it adds no setup file, reporter or recording redirect and serves the live page instead. Test runs do not change.
- The manifest has a new field, `configFile`: the config file of the run, relative to `root`.
- `@describe-me/react` peers on `react-dom` `^18.0.0 || ^19.0.0`.
