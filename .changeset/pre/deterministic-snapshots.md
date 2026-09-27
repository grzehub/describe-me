---
'@describe-me/core': minor
'@describe-me/vitest': minor
---

Deterministic snapshots: identical DOM is now stored once.

- rrweb node ids restart at 1 for every capture and `rootId` is gone, so two captures of the same DOM serialize to the same text and share one file in `snapshots/`. Snapshot file names change: the first full run after upgrading rewrites them and garbage-collects the old ones.
- **Type change (`@describe-me/core`):** `Frame.snapshot` is now `string` (the rrweb serialized document as JSON text) instead of `unknown`, so code reading `task.meta.describeMe` directly gets a string per frame. The reporter still accepts object snapshots from an older core; upgrade all `@describe-me/*` packages together.
- Frames are compared by their exact serialized text. A change to an element's HTML `id` attribute now counts as a change (it used to be ignored).
- `recorder.capture(..., { settle: false })` takes the snapshot and records the frame before it returns.

No exports added or removed.
