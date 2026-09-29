---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

The reporter lists the font families that frames use but nothing loads, and the hosts that frames load stylesheets from.

- **New manifest fields** `Manifest.fontsMissing` (`FontMissing[]` with `family`, `tests` and `testId`, the first test that misses it) and `Manifest.remoteStylesheets` (`RemoteStylesheet[]` with `host` and `frames`). Both types are exported from `@describe-me/core` and `@describe-me/core/types`. Manifests written before this version do not have them, which counts as empty.
- **`ManifestDiagnostics` has two new required members**, `fontsMissing` and `remoteStylesheets`, which `manifestDiagnostics()` fills. Code that builds a `ManifestDiagnostics` object itself has to add them.
- A family counts as missing when it is the first family of a `font-family` or `font` declaration, with `var()` followed, and it is neither a generic or system family nor loaded by an `@font-face` rule, Google Fonts, Bunny Fonts or Fontsource on jsDelivr, in the frame or in the preview head. A stylesheet from any other host turns the check off for that frame, or for every frame when the preview head links it. So Adobe Fonts and custom CDNs never cause false alarms.
- The reporter prints one warning line for each list. The viewer's issues chip shows both, and each missing family links to its first test.

No existing export is renamed or removed.
