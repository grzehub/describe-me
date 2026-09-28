---
'@describe-me/core': minor
'@describe-me/vitest': minor
'@describe-me/react': minor
---

Render frame timing: an opt-in `renderFrame` option takes the render frame once async content has loaded, and frames keep the order the test asked for them.

- **New plugin option `renderFrame`** (`@describe-me/vitest/plugin`): `'eager'` (default, unchanged), `'lazy'` or `{ pending: string, timeout?: number }`. `'lazy'` takes the render frame right before the test's next interaction (a user event, `step()`, `fireEvent`, `render`, `rerender`, `unmount` or `cleanup`), or at the end of the test. `{ pending }` takes it as soon as nothing matches the CSS selector and the page shows content, and falls back to `'lazy'` after `timeout` ms (default 2000). Every render frame follows it, `rerender` included. The plugin rejects any other value before tests run, and an invalid selector fails when the setup file loads.
- **Frames keep call order.** A frame sits where its capture was called, not where it finished. A capture still running when its test ends is dropped, so an interaction or `step()` the test did not await no longer lands in the next test or hides its first action. `at` is still the time the snapshot was taken.
- **New recorder methods** (`@describe-me/core`, also through `@describe-me/vitest`). `recorder.configure({ renderFrame })` is called by the setup files with the plugin's option. Without the plugin, call it in your own setup file, listed after describe-me's. `recorder.beforeInteraction()` takes a deferred render frame now, for adapters. `recorder.flush()` waits for captures in flight, takes a deferred render frame and resolves to whether it took one. `recorder.generation` identifies the current test.
- **New types** (`@describe-me/core`): `RenderFrameMode` and `RecorderOptions`, and the field `CaptureOptions.generation`. Pass `recorder.generation` as read when an interaction began, and a capture from an earlier test is dropped.
- The `'describe-me'` key on Vitest's `ProvidedContext` gains `renderFrame`.
- `@describe-me/react`: `render`, `rerender`, `unmount`, `fireEvent` and `cleanup` take a deferred render frame before they change the page. Signatures are unchanged.

No exports removed. With the default `'eager'`, a test that awaits its interactions records the same frames as before.
