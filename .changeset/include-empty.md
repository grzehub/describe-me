---
'@describe-me/vitest': patch
---

An empty `include` records nothing.

- **`include: []` selects no test file** (`describeMe()` and `DescribeMeReporter`). It used to select every file, like a missing `include`. The reporter warns once when Vitest starts. Leaving `include` out still records every test file.
- **`exclude: '**'` keeps the plugin on and records nothing**, without a warning. The README describes both.
- The `'describe-me'` key on Vitest's `ProvidedContext` types `include` as `CompiledGlob[] | null`, where `null` means every test file.

No exports change.
