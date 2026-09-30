---
'@describe-me/vitest': patch
'@describe-me/core': patch
'describe-me': patch
---

In jsdom, styled-components 6.0 to 6.3 no longer fail to load under Vite 6 and 7. These versions import tslib, and the optimizer bundled tslib's UMD file without its default export, so every test that imported styled-components failed with `Cannot destructure property '__extends' of 'import_tslib.default'`. The plugin points `tslib` at the `tslib.es6.mjs` that styled-components resolves. A `tslib` alias in your own `vitest.config.ts` is no longer needed.

When that tslib is older than 2.5.3 and has no `tslib.es6.mjs` (styled-components 6.1.3 to 6.1.9 pin 2.5.0), the plugin leaves tslib alone and warns after the run: upgrade styled-components to 6.1.10 or later, or override tslib to 2.5.3 or later. The viewer lists the same warning behind its issues chip.

Public API:

- `@describe-me/core/types`: `Manifest.setupWarnings` and `ManifestDiagnostics.setupWarnings`. The second is a required member, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add it.
- `@describe-me/vitest/reporter`: the `setupWarnings` option of `DescribeMeReporterOptions`.

No existing export is renamed or removed.
