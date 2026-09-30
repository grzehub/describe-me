---
'@describe-me/core': patch
'@describe-me/react': patch
'@describe-me/vitest': patch
'describe-me': patch
---

A guard against mixed describe-me versions in one project.

- **A clear error instead of `is not a function`** (`@describe-me/core`). The shared test recorder carries a protocol number, `recorder.protocol`. When a copy of `@describe-me/core` finds a recorder that a copy with another protocol created, importing it throws "describe-me: all describe-me packages must be on the same version…". A recorder created by 0.5.0 is accepted. One created by 0.4 is not, so `@describe-me/react` 0.5.1 with `@describe-me/vitest` 0.4 fails every test file with that message.
- **The manifest names its writer** (`@describe-me/core`, `@describe-me/vitest`). `manifest.json` gets `generator: { name, version }`, the reporter package and its version. The type is `Manifest.generator?: ManifestGenerator`, absent in manifests written before 0.5.1.
- **The viewer warns about data from another version** (`describe-me`). A banner under the header names both versions when their major.minor differs. Data without `generator` shows no banner, because this viewer reads everything written before 0.5.1.
- **Peer dependencies between the packages** (`@describe-me/react`, `@describe-me/vitest`). `@describe-me/react` peers on `@describe-me/vitest`, and `@describe-me/vitest` has an optional peer on `describe-me`. Both ranges start at this release (`^0.5.1`), so the package manager reports a mix at install time.

Added: the `ManifestGenerator` type (`@describe-me/core`, `@describe-me/core/types`) and the read-only `recorder.protocol`. Nothing removed or renamed.
