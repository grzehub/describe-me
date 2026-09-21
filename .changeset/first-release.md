---
'describe-me': minor
'@describe-me/core': minor
'@describe-me/react': minor
'@describe-me/vitest': minor
---

First public release. Living component documentation generated from Vitest
browser-mode tests: a recorder that captures a DOM frame after every render,
interaction and `step()`, a Vitest plugin that wires it up in one line, a
reporter that reads component props from TypeScript, and the `describe-me` CLI
with a viewer (`dev`) and a static site build (`build`). React only for now.
