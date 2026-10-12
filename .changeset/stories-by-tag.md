---
'@describe-me/vitest': minor
'@describe-me/core': minor
---

Pick single tests for the docs with Vitest tags. `describeMe({ stories })` takes `'all'` (default, every test of the recorded files) or `'tagged'` (only tests tagged `docs`, on the test, a `describe` or the file through `@module-tag docs`). A test tagged `no-docs` is never a story. The plugin defines both tags in `test.tags`. `stories: 'tagged'` needs Vitest 4.1 and throws on 4.0.

- `DescribeMeOptions` and `DescribeMeReporterOptions` add `stories`.
- `ManifestTest` adds `tags`, so a filtered run drops tests the current `stories` no longer selects.
