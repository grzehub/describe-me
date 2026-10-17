---
'@describe-me/core': patch
'@describe-me/vitest': patch
'describe-me': patch
---

Recorded data and the static site no longer name the machine that ran the tests. Snapshots drop every `<script>`, which the viewer never runs. Vite's `data-vite-dev-id` becomes a path relative to the project root, or a `node_modules/…` path for a package outside it, or is left out. Test errors, `setupWarnings` and `assetsMissing` name files relative to the root, so an `assetsMissing` entry outside the root reads `../…` or `node_modules/…` instead of `/@fs/<absolute path>`. `describe-me build` writes a project id as `root` in the site's copy of the manifest, and the live build names source files relative to the root. `.describe-me/manifest.json` keeps the absolute `root`. Snapshot hashes change once. A filtered run keeps the snapshots an earlier version wrote for the tests it skips, so run the whole suite once after upgrading.
