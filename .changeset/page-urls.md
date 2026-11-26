---
'@describe-me/core': patch
'@describe-me/vitest': patch
---

Stored snapshots no longer name the server of the test page, so the same DOM gets the same snapshot file in every run. Before, a run on another port, which Vitest picks when its usual one is taken, stored every browser-mode frame under a new name, and a link such as `href="#top"` carried Vitest's session id and the absolute path of the test file into the snapshot and the static site. A URL on the test page's server that names no project file is now stored as `describe-me-page:` and what followed the origin, such as `describe-me-page:/pricing`, and a link into the page itself as `describe-me-page:#top`. It loads nothing in the viewer, as before. The links of Vitest's own page, its icon and the preload of its runner, are left out. `@describe-me/core` exports `PAGE_URL_PREFIX`, and `TestRecord` has an optional `page`. Snapshot hashes change once. A filtered run keeps the snapshots an earlier version wrote for the tests it skips, so run the whole suite once after upgrading.
