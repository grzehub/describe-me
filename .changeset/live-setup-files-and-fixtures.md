---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

Live preview of setup files and fixtures. The live page imports the project's `test.setupFiles` before the test file, under the same shims, and their hooks run as in Vitest. It computes the `test.extend` fixtures a test uses, without their teardown. It runs `aroundEach` and `aroundAll` around the rest of the arrange phase, and names `each` and `for` rows the way the installed Vitest does.

- `describeMe({ live })`: `live: { setupFiles }` replaces `test.setupFiles` for the live preview, for a setup file that needs Node such as MSW's `setupServer`. `live: false` switches the preview off for the project. Test runs ignore the option.
- `LiveStatus` adds `setup-failed`: a setup file did not load in the browser. The detail names the file.
- `vi.mock` and `vi.doMock` still do nothing live. The page posts a `notice` that names the module, and the inspector lists it.
- A package that imports `vitest`, such as `@testing-library/jest-dom/vitest`, gets the shim too.
- The plugin exposes `api.live.enabled`. With `live: false`, `createLiveServer()` rejects with the code `DESCRIBE_ME_LIVE_OFF`, and `describe-me dev` reports the preview as off and hides the Live toggle.
- `LivePageOptions` of `@describe-me/vitest/live-runtime` takes `setupFiles` and `vitestMajor`.
- The recording hooks destructure the test context, so a test from `test.extend` no longer fails in Vitest with "The 1st argument inside a fixture must use object destructuring pattern".
