---
'describe-me': minor
'@describe-me/core': minor
---

Tags in the viewer. A test's Vitest tags show next to its name and in the inspector, and the search matches them. A click on a tag in the inspector narrows the sidebar to the tests with that tag. The tag is part of the link (`tag=`), × above the tree clears it, and ↑ ↓ follow it. `docs` and `no-docs` do not show.

- `@describe-me/core/types` exports `DOCS_TAG` and `NO_DOCS_TAG`, which `@describe-me/vitest` now takes from there.
