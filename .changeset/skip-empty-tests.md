---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

Tests that render nothing are left out, and new `include` / `exclude` options choose which test files are recorded.

- **Empty tests are skipped.** A test that records no frame before the closing one (no recording `render`, no interaction, no `step()`) now costs nothing: `recorder.capture('end', …)` returns before settling or taking a snapshot, and the reporter leaves the test out of the manifest. This includes failed tests without frames. Vitest still reports the failure. A test that renders outside the recording `render` (for example with `createRoot` by hand) is now left out too. Call `step()` to keep it. The viewer also hides such tests, and modules left empty, in data written by older versions.
- **Filtered runs keep documentation.** A test skipped in a run (`.only`, `-t`, `.skip`) keeps the entry the previous run recorded for it, when its id and full name match.
- **New plugin options `include` and `exclude`** (`string | string[]`): globs relative to the Vitest root, matched with picomatch, dotfiles included. `exclude` wins. Tests in other files still run but are not recorded, and their modules are removed from the manifest, including ones kept from an earlier run.
- **New reporter options `include` and `exclude`** on `@describe-me/vitest/reporter`, with the same effect on the manifest. Without the plugin the setup file does not know them, so those tests are still recorded.
- Concurrent tests (`test.concurrent`, `describe.concurrent`, `sequence.concurrent`) are not recorded, since they would share one recorder. The setup file warns once per file.
- The plugin hands its runtime options to the setup files through Vitest's `provide` / `inject` under the key `'describe-me'`, which `@describe-me/vitest` declares on Vitest's `ProvidedContext`. Do not provide that key yourself.
- `@describe-me/vitest` now depends on `picomatch` (already installed with Vitest).

No exports added or removed.
