---
'@describe-me/core': patch
'@describe-me/vitest': patch
---

One mistake no longer breaks a whole test run.

- **A `renderFrame.pending` selector the test environment cannot parse falls back to `'lazy'`** (`@describe-me/core`). Every test file used to fail at setup. The recorder warns once per test file and takes render frames as with `renderFrame: 'lazy'`.
- **Garbage collection leaves folders alone** (`@describe-me/vitest`). A folder inside `.describe-me/snapshots`, `styles` or `assets` stopped the reporter before it wrote `manifest.json`. Stray files are still deleted.

No exports change.
