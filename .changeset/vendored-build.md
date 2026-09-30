---
'describe-me': patch
---

`describe-me build` keeps the built site consistent after it vendors fonts.

- **The issues menu lists only hosts that stay remote.** The copied manifest's `remoteStylesheets` is counted again from the vendored snapshots, style chunks and CSS assets, the way the reporter counts it. A host whose stylesheets were all downloaded is no longer listed.
- **Rewritten style chunks and CSS assets are named after their new text.** Every snapshot, chunk, CSS asset and preview head that names one is updated, and the old file is removed. After a redeploy, a browser can no longer use a cached chunk or CSS asset that points at files the site no longer has.

Snapshot files keep their names, because the viewer always fetches them fresh. The source data directory and `describe-me dev` are unchanged. No exports change.
