---
'@describe-me/vitest': minor
'@describe-me/core': minor
---

Pick single tests for the docs with Vitest tags. `describeMe({ stories })` takes `'all'` (default, every test of the recorded files) or `'tagged'` (only tests tagged `docs`, on the test, a `describe` or the file through `@module-tag docs`). A test tagged `no-docs` is never a story. The plugin defines both tags in `test.tags`. Tags need Vitest 4.1: on 4.0 `stories: 'tagged'` throws, and `no-docs` has no effect.

- `DescribeMeOptions` and `DescribeMeReporterOptions` add `stories`.
- `ManifestTest` adds `tags`, so a filtered run drops tests the current `stories` no longer selects.
