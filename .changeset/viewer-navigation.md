---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

Test ids survive edits to the test file, and the viewer gets history, search, collapsible suites and source order.

- **`ManifestTest.id` changes meaning** (`@describe-me/core/types`). The reporter writes a stable id: the first 12 hex characters of a SHA-1 of the module path, the suite path, the test name and, for a name repeated in the same suite, its occurrence. It stays the same when other tests are added, removed or reordered, and on other machines. Renaming a test or moving it to another suite or file changes it. `ManifestDiagnostics.anonymous[].testId` holds the same id. Tools that matched manifest ids with Vitest's `TestCase.id` should read `vitestId`.
- **New field `ManifestTest.vitestId`** (`@describe-me/core/types`): Vitest's `TestCase.id` in the run that recorded the test. Absent in manifests written before this version.
- The first run after the upgrade gives every test in the manifest its new id, including tests kept from an earlier run, and keeps the old id as `vitestId`.
- **Old links keep working.** A `#test=` link with a Vitest id opens its test, and the viewer rewrites the link to the new id.
- **Back and Forward** move between the tests and overviews you opened. Stepping through frames and changing the viewport update the link without adding history entries.
- **The sidebar follows source order.** A test declared after a nested `describe` is listed after it, not above it.
- **A search field** at the top of the sidebar filters tests by name, suite, file and component. Every word must match. `/` focuses it, Esc clears it, Enter or ↓ opens the first match.
- **Files and `describe` blocks collapse** with the arrow next to them. The viewer remembers this per project in the browser's local storage.
- **↑ and ↓** move through the tests the sidebar shows, in its order.

No exports added or removed.
